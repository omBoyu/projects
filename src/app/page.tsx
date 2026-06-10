"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plane,
  Luggage,
  MapPin,
  Calendar,
  Compass,
  Loader2,
  Sparkles,
  ArrowRight,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  LogOut,
  UserRound,
  KeyRound,
} from "lucide-react";

interface AppUser {
  id: number;
  username: string;
  created_at: string;
}

interface TravelRecord {
  id: number;
  user_id: number | null;
  username: string | null;
  destination: string;
  travel_time: string;
  result: string | null;
  created_at: string;
}

interface AuthRequestBody {
  username: string;
  password: string;
  turnstileToken?: string;
}

export default function Home() {
  const [destination, setDestination] = useState("");
  const [travelTime, setTravelTime] = useState("");
  const [result, setResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Auth state
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [initialAuthLoading, setInitialAuthLoading] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState("");

  // History state
  const [history, setHistory] = useState<TravelRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history?limit=20");
      if (res.status === 401) {
        setHistory([]);
        return;
      }

      const json = await res.json();
      if (json.success) {
        setHistory(json.data);
      }
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();
        setCurrentUser(json.user ?? null);
      } catch {
        setCurrentUser(null);
      } finally {
        setInitialAuthLoading(false);
      }
    }

    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchHistory();
    } else {
      setHistory([]);
    }
  }, [currentUser, fetchHistory]);

  const handleAuthSubmit = useCallback(async () => {
    if (!authUsername.trim() || !authPassword) return;
    if (authMode === "register" && !turnstileToken) {
      setAuthError("请完成验证码");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      const body: AuthRequestBody = {
        username: authUsername.trim(),
        password: authPassword,
      };
      if (authMode === "register") body.turnstileToken = turnstileToken;

      const res = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "认证失败");
      }

      setCurrentUser(json.user);
      setAuthUsername("");
      setAuthPassword("");
      setAuthError("");
      setResult("");
      setHasResult(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "认证失败");
    } finally {
      setAuthLoading(false);
    }
  }, [authMode, authPassword, authUsername, turnstileToken]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setHistory([]);
    setResult("");
    setHasResult(false);
    setDestination("");
    setTravelTime("");
  }, [fetchHistory]);

  const handleGenerate = useCallback(async () => {
    if (!currentUser || !destination.trim() || !travelTime.trim()) return;

    setIsGenerating(true);
    setResult("");
    setHasResult(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination.trim(),
          travelTime: travelTime.trim(),
        }),
      });

      if (response.status === 401) {
        setCurrentUser(null);
        throw new Error("请先登录");
      }

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "请求失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                accumulated += `\n\n> ❌ ${parsed.error}`;
                setResult(accumulated);
              } else if (parsed.done) {
                // streaming done
              } else if (parsed.content) {
                accumulated += parsed.content;
                setResult(accumulated);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      // Refresh history after generation completes
      fetchHistory();

      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      setResult(
        `生成攻略时发生错误，请稍后重试。\n\n> ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    } finally {
      setIsGenerating(false);
    }
  }, [currentUser, destination, travelTime, fetchHistory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isGenerating) {
        handleGenerate();
      }
    },
    [handleGenerate, isGenerating]
  );

  const handleHistoryClick = useCallback(
    (record: TravelRecord) => {
      setDestination(record.destination);
      setTravelTime(record.travel_time);
      if (record.result) {
        setResult(record.result);
        setHasResult(true);
        setExpandedRecord(null);
        setTimeout(() => {
          resultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    },
    []
  );

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const isAuthView = !initialAuthLoading && !currentUser;

  return (
    <div className="min-h-screen text-[#2C2C2C]">
      {/* Hero Section */}
      <section
        className={
          isAuthView
            ? "relative min-h-screen overflow-hidden"
            : "relative overflow-hidden"
        }
      >
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16">
          {/* Header */}
          <div className="text-center mb-12">
            <div
              className={
                isAuthView
                  ? "inline-flex items-center gap-2 border border-slate-950/10 bg-white/70 text-[#2D7D7B] px-4 py-1.5 rounded-full text-sm font-medium mb-6 shadow-lg shadow-slate-950/5 backdrop-blur-md"
                  : "inline-flex items-center gap-2 bg-[#2D7D7B]/10 text-[#2D7D7B] px-4 py-1.5 rounded-full text-sm font-medium mb-6"
              }
            >
              <Compass className="w-4 h-4" />
              Real-AI 智能旅行顾问
            </div>
            <h1
              className={
                isAuthView
                  ? "font-serif text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-950 to-neutral-700/80 mb-4 leading-tight"
                  : "font-serif text-4xl md:text-5xl font-bold text-[#D4A574] mb-4 leading-tight"
              }
            >
              你的下一段旅程
              <br />
              <span>从这里开始</span>
            </h1>
            <p
              className={
                isAuthView
                  ? "text-[#6B6B6B] text-lg max-w-xl mx-auto leading-relaxed"
                  : "text-[#6B6B6B] text-lg max-w-xl mx-auto leading-relaxed"
              }
            >
              输入目的地和旅行时间，AI
              为你量身定制旅行攻略与行李清单，让每一次出发都从容不迫~
            </p>
          </div>

          {initialAuthLoading ? (
            <Card className="max-w-2xl mx-auto border-[#E5DDD3]/60 shadow-lg shadow-[#2D7D7B]/5 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8 flex items-center justify-center gap-3 text-[#6B6B6B]">
                <Loader2 className="w-5 h-5 animate-spin text-[#2D7D7B]" />
                正在确认登录状态...
              </CardContent>
            </Card>
          ) : !currentUser ? (
            <Card className="max-w-md mx-auto border-black/10 bg-white/85 text-[#2C2C2C] shadow-2xl shadow-slate-950/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="font-serif text-[#2C2C2C] flex items-center gap-2">
                  <UserRound className="w-5 h-5 text-[#2D7D7B]" />
                  {authMode === "login" ? "登录账号" : "注册账号"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="space-y-2">
                  <Label htmlFor="authUsername" className="text-[#2C2C2C]">
                    用户名
                  </Label>
                  <Input
                    id="authUsername"
                    placeholder="3-30 位字母、数字或下划线"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    disabled={authLoading}
                    className="h-11 border-[#E5DDD3] bg-white/90 text-[#2C2C2C] placeholder:text-[#6B6B6B]/70 focus-visible:ring-[#2D7D7B]/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="authPassword"
                    className="flex items-center gap-2 text-[#2C2C2C]"
                  >
                    <KeyRound className="w-4 h-4 text-[#D4A574]" />
                    密码
                  </Label>
                  <Input
                    id="authPassword"
                    type="password"
                    placeholder="至少 8 位"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !authLoading) {
                        handleAuthSubmit();
                      }
                    }}
                    disabled={authLoading}
                    className="h-11 border-[#E5DDD3] bg-white/90 text-[#2C2C2C] placeholder:text-[#6B6B6B]/70 focus-visible:ring-[#D4A574]/30"
                  />
                </div>
                {authError && (
                  <div className="text-sm text-red-700 bg-red-50/90 border border-red-200 rounded-md px-3 py-2">
                    {authError}
                  </div>
                )}
                <Button
                  onClick={handleAuthSubmit}
                  disabled={
                    authLoading || !authUsername.trim() || !authPassword
                  }
                  className="h-11 bg-[#2D7D7B] text-white shadow-lg shadow-[#2D7D7B]/20 hover:bg-[#256B69]"
                >
                  {authLoading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {authMode === "login" ? "登录" : "注册并登录"}
                </Button>
                {authMode === "register" && (
                  <div className="pt-2">
                    <Turnstile
                      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
                      onSuccess={(token) => setTurnstileToken(token)}
                      onError={() => setAuthError("验证码加载失败，请重试")}
                    />
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError("");
                    setTurnstileToken("");
                  }}
                  className="text-[#2D7D7B] hover:bg-[#2D7D7B]/10 hover:text-[#256B69]"
                >
                  {authMode === "login"
                    ? "没有账号？去注册"
                    : "已有账号？去登录"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="max-w-2xl mx-auto grid gap-4">
              <div className="flex items-center justify-between rounded-md border border-[#E5DDD3]/60 bg-white/70 px-4 py-3 text-sm text-[#6B6B6B]">
                <div className="flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-[#2D7D7B]" />
                  当前用户：
                  <span className="font-medium text-[#2C2C2C]">
                    {currentUser.username}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-[#6B6B6B] hover:text-[#2D7D7B]"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  退出
                </Button>
              </div>

              {/* Input Form Card */}
              <Card className="border-[#E5DDD3]/60 shadow-lg shadow-[#2D7D7B]/5 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 md:p-8">
                  <div className="grid gap-6">
                    {/* Destination Input */}
                    <div className="space-y-2.5">
                      <Label
                        htmlFor="destination"
                        className="text-[#2C2C2C] font-medium flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4 text-[#2D7D7B]" />
                        旅行目的地
                      </Label>
                      <Input
                        id="destination"
                        placeholder="例如：日本京都、泰国清迈、云南大理..."
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-12 text-base border-[#E5DDD3] focus:border-[#2D7D7B] focus:ring-[#2D7D7B]/20 bg-white"
                        disabled={isGenerating}
                      />
                    </div>

                    {/* Travel Time Input */}
                    <div className="space-y-2.5">
                      <Label
                        htmlFor="travelTime"
                        className="text-[#2C2C2C] font-medium flex items-center gap-2"
                      >
                        <Calendar className="w-4 h-4 text-[#D4A574]" />
                        旅行时间
                      </Label>
                      <Input
                        id="travelTime"
                        placeholder="例如：5月中旬、7天、国庆黄金周..."
                        value={travelTime}
                        onChange={(e) => setTravelTime(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-12 text-base border-[#E5DDD3] focus:border-[#D4A574] focus:ring-[#D4A574]/20 bg-white"
                        disabled={isGenerating}
                      />
                    </div>

                    {/* Generate Button */}
                    <Button
                      onClick={handleGenerate}
                      disabled={
                        isGenerating ||
                        !destination.trim() ||
                        !travelTime.trim()
                      }
                      className="h-12 text-base font-medium bg-[#2D7D7B] hover:bg-[#256B69] text-white transition-all duration-300 disabled:opacity-50"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          AI 正在生成攻略...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          生成旅行攻略
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* History Section */}
      {history.length > 0 && (
        <section className="relative z-10 max-w-4xl mx-auto px-6 pb-8">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-[#6B6B6B] hover:text-[#2D7D7B] transition-colors text-sm font-medium group"
          >
            <History className="w-4 h-4" />
            <span>查询历史（{history.length} 条）</span>
            {showHistory ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showHistory && (
            <div className="mt-4 grid gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-[#6B6B6B] text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载历史记录...
                </div>
              ) : (
                history.map((record) => (
                  <Card
                    key={record.id}
                    className="border-[#E5DDD3]/40 bg-white/70 hover:shadow-md hover:border-[#2D7D7B]/30 transition-all duration-200 cursor-pointer"
                  >
                    <CardContent
                      className="p-4"
                      onClick={() => handleHistoryClick(record)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#2D7D7B]/10 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-[#2D7D7B]" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[#2C2C2C] truncate">
                              {record.destination}
                            </div>
                            <div className="text-xs text-[#6B6B6B] truncate">
                              {record.travel_time}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#6B6B6B] flex-shrink-0 ml-3">
                          <Clock className="w-3 h-3" />
                          {formatDate(record.created_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {/* Result Section */}
      {hasResult && (
        <section
          ref={resultRef}
          className="relative z-10 max-w-4xl mx-auto px-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700"
        >
          {/* Destination Tag */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-8 bg-gradient-to-b from-[#2D7D7B] to-[#D4A574] rounded-full" />
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">
                {destination}
              </h2>
              <p className="text-[#6B6B6B] text-sm">{travelTime}</p>
            </div>
          </div>

          {/* Two-column result cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Travel Guide Card */}
            <Card className="border-[#E5DDD3]/60 shadow-md shadow-[#2D7D7B]/5 bg-white/90 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#2D7D7B]/10 to-transparent border-b border-[#E5DDD3]/40 pb-4">
                <CardTitle className="flex items-center gap-2 text-[#2D7D7B] font-serif">
                  <Plane className="w-5 h-5" />
                  旅行攻略
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {isGenerating && !result ? (
                  <div className="flex items-center gap-3 text-[#6B6B6B]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#2D7D7B]" />
                    <span>正在规划你的旅程...</span>
                  </div>
                ) : (
                  <div className="markdown-content text-sm leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
                    <ReactMarkdown>
                      {extractSection(result, "旅行攻略")}
                    </ReactMarkdown>
                    {isGenerating && <span className="typing-cursor" />}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Luggage Suggestions Card */}
            <Card className="border-[#E5DDD3]/60 shadow-md shadow-[#D4A574]/5 bg-white/90 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-[#D4A574]/10 to-transparent border-b border-[#E5DDD3]/40 pb-4">
                <CardTitle className="flex items-center gap-2 text-[#D4A574] font-serif">
                  <Luggage className="w-5 h-5" />
                  行李建议
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {isGenerating && !result ? (
                  <div className="flex items-center gap-3 text-[#6B6B6B]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#D4A574]" />
                    <span>正在整理行李清单...</span>
                  </div>
                ) : (
                  <div className="markdown-content text-sm leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
                    <ReactMarkdown>
                      {extractSection(result, "行李建议")}
                    </ReactMarkdown>
                    {isGenerating && <span className="typing-cursor" />}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#E5DDD3]/40 bg-white/35 py-8 text-center text-sm text-[#6B6B6B] backdrop-blur-sm">
        <p>AI 旅行攻略助手 · 内容仅供参考，请以实际情况为准</p>
      </footer>
    </div>
  );
}

function extractSection(fullText: string, sectionTitle: string): string {
  if (!fullText) return "";

  // Find the section header with emoji pattern
  const sectionPatterns = [
    new RegExp(`## [^\\n]*${sectionTitle}[^\\n]*\\n`),
    new RegExp(`## ${sectionTitle}\\n`),
  ];

  let sectionStart = -1;
  for (const pattern of sectionPatterns) {
    const match = fullText.match(pattern);
    if (match && match.index !== undefined) {
      sectionStart = match.index;
      break;
    }
  }

  if (sectionStart === -1) {
    return "";
  }

  // Find the next ## header after our section
  const afterSection = fullText.slice(sectionStart);
  const nextSectionMatch = afterSection.match(
    /\n## (?![^\n]*行程攻略)(?![^\n]*行李建议)/
  );

  if (nextSectionMatch && nextSectionMatch.index !== undefined) {
    return afterSection.slice(0, nextSectionMatch.index);
  }

  // Check for the divider that separates the two main sections
  const dividerMatch = afterSection.match(/\n---\n/);
  if (dividerMatch && dividerMatch.index !== undefined) {
    if (sectionTitle === "旅行攻略") {
      return afterSection.slice(0, dividerMatch.index);
    }
    const afterDivider = afterSection.slice(dividerMatch.index + 5);
    return afterDivider;
  }

  return afterSection;
}
