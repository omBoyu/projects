import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import {
  insertTravelRecord,
  updateTravelRecordResult,
} from "@/storage/database/travel-records";

function getDashScopeResponsesUrl(): string {
  return (
    process.env.DASHSCOPE_RESPONSES_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1/responses"
  );
}

function extractContentFromChunk(value: unknown): string {
  if (!value || typeof value !== "object") return "";

  const data = value as {
    type?: unknown;
    delta?: unknown;
    choices?: Array<{
      delta?: { content?: unknown; reasoning_content?: unknown };
      message?: { content?: unknown };
      text?: unknown;
    }>;
    content?: unknown;
    output_text?: unknown;
    response?: {
      output_text?: unknown;
    };
  };

  const choice = data.choices?.[0];
  const content =
    (data.type === "response.output_text.delta" ? data.delta : undefined) ??
    choice?.delta?.content ??
    choice?.message?.content ??
    choice?.text ??
    data.content ??
    data.output_text ??
    data.response?.output_text;

  return typeof content === "string" ? content : "";
}

export async function POST(request: NextRequest) {
  const { destination, travelTime } = await request.json();

  if (!destination || !travelTime) {
    return new Response(
      JSON.stringify({ error: "请提供旅行目的地和旅行时间" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return new Response(
      JSON.stringify({ error: "请先登录后再生成旅行攻略" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "DASHSCOPE_API_KEY is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Save travel record to database (without result initially)
  let recordId: number | null = null;
  try {
    recordId = await insertTravelRecord(
      user.id,
      user.username,
      destination,
      travelTime
    );
  } catch (dbError) {
    console.error("Database insert error:", dbError);
    // Non-blocking: continue even if DB save fails
  }

  const systemPrompt = `你是一位资深旅行顾问，擅长为旅行者提供详尽、实用的旅行攻略和行李建议。你的回答应该结构清晰、信息丰富、具有可操作性。

请按以下结构生成内容，使用 Markdown 格式：

## 🗺️ 旅行攻略

### 📍 目的地概览
简要介绍该目的地的特色、最佳旅行季节和文化亮点。

### 🏛️ 必游景点（推荐5-8个）
每个景点包含：名称、推荐理由、建议游览时长、小贴士

### 🍜 美食推荐（推荐5-6种）
当地特色美食，包含菜品名、特色描述、推荐餐厅/区域

### 🚗 交通指南
如何到达、当地交通方式、交通卡/票务建议

### 💡 实用贴士
货币、语言、时差、电压、网络、安全等实用信息

---

## 🧳 行李建议

### 👕 服装建议
根据旅行时间和目的地气候，详细列出应携带的衣物（上装、下装、外套、鞋履等）

### 🎒 必备物品
证件、电子设备、洗护用品、药品等

### 🌤️ 天气应对
根据季节特点的特别提醒

### 💼 打包小技巧
节省空间、防皱、收纳等实用建议`;

  const userPrompt = `我要去${destination}旅行，旅行时间是${travelTime}。请为我生成详细的旅行攻略和行李建议。`;

  const encoder = new TextEncoder();
  let fullResult = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmResponse = await fetch(getDashScopeResponsesUrl(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.DASHSCOPE_LLM_MODEL ?? "qwen3.7-plus",
            instructions: systemPrompt,
            input: userPrompt,
            temperature: 0.8,
            stream: true,
          }),
        });

        if (!llmResponse.ok) {
          const errorBody = await llmResponse.text();
          throw new Error(
            `LLM request failed: ${llmResponse.status} ${errorBody}`
          );
        }

        if (!llmResponse.body) {
          throw new Error("LLM response body is empty");
        }

        const reader = llmResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const lines = event
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim());

            for (const line of lines) {
              if (!line || line === "[DONE]") continue;

              const parsed = JSON.parse(line) as unknown;
              const content = extractContentFromChunk(parsed);
              if (!content) continue;

              fullResult += content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ content })}\n\n`
                )
              );
            }
          }
        }

        if (!fullResult && buffer.trim()) {
          for (const line of buffer.split("\n")) {
            const data = line.startsWith("data:")
              ? line.slice(5).trim()
              : line.trim();
            if (!data || data === "[DONE]") continue;

            const parsed = JSON.parse(data) as unknown;
            const content = extractContentFromChunk(parsed);
            if (!content) continue;

            fullResult += content;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content })}\n\n`
              )
            );
          }
        }

        if (!fullResult) {
          throw new Error(
            "LLM returned an empty response. Please verify DASHSCOPE_API_KEY, DASHSCOPE_RESPONSES_URL, and DASHSCOPE_LLM_MODEL."
          );
        }

        // Update database with the full result
        if (recordId !== null) {
          try {
            await updateTravelRecordResult(recordId, fullResult);
          } catch (dbError) {
            console.error("Database update error:", dbError);
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();
      } catch (error) {
        const cause =
          error instanceof Error && error.cause instanceof Error
            ? `: ${error.cause.message}`
            : "";
        const errorMessage =
          error instanceof Error
            ? `${error.message}${cause}`
            : "生成攻略时发生错误";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
