"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: string[];
};

type LocalModel = {
  id: string;
  label: string;
  runtime: "Ollama";
  sizeBytes: number;
  parameterSize: string;
  quantization: string;
  family: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
    size?: number;
    details?: {
      family?: string;
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "크기 정보 없음";
  return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
};

const formatModelLabel = (id: string) => {
  const match = id.match(/^gemma4:(e\d+b)$/i);
  if (match) return `Gemma 4 ${match[1].toUpperCase()}`;
  return id;
};

const recentWorks = [
  { title: "지역상권 활성화 검토", meta: "오늘 · 자료 4개" },
  { title: "청년정책 추진계획 요약", meta: "어제 · 자료 7개" },
  { title: "주간업무 보고서 초안", meta: "7월 24일 · 자료 2개" },
];

const suggestions = [
  {
    eyebrow: "보고서 작성",
    title: "참고자료로 검토보고서 초안 만들기",
    prompt: "등록된 참고자료를 바탕으로 검토보고서 초안을 작성해줘.",
    tone: "mint",
  },
  {
    eyebrow: "자료 분석",
    title: "여러 문서의 핵심 쟁점 비교하기",
    prompt: "참고자료들의 핵심 쟁점과 서로 다른 내용을 표로 비교해줘.",
    tone: "blue",
  },
  {
    eyebrow: "문장 다듬기",
    title: "공공문서 문체로 명확하게 고치기",
    prompt: "아래 문장을 간결하고 명확한 공공문서 문체로 다듬어줘.",
    tone: "sand",
  },
  {
    eyebrow: "규정 확인",
    title: "근거가 있는 답변만 받아보기",
    prompt: "등록된 자료에서 관련 규정을 찾아 근거 위치와 함께 답해줘.",
    tone: "lilac",
  },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryState, setDiscoveryState] = useState<"idle" | "scanning" | "found" | "error">("idle");
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveredModels, setDiscoveredModels] = useState<LocalModel[]>([]);
  const [activeModel, setActiveModel] = useState<LocalModel>({
    id: "gemma4:e2b",
    label: "Gemma 4 E2B",
    runtime: "Ollama",
    sizeBytes: 0,
    parameterSize: "5.1B",
    quantization: "Q4",
    family: "gemma4",
  });
  const [workspace, setWorkspace] = useState("새 업무");
  const [files, setFiles] = useState([
    { name: "2026년 업무계획.pdf", pages: "12쪽" },
    { name: "검토보고서 서식.hwpx", pages: "서식" },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitPrompt = async (prompt: string) => {
    const clean = prompt.trim();
    if (!clean || isThinking) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      text: clean,
    };
    const conversation = [...messages, userMessage];

    setMessages((current) => [
      ...current,
      userMessage,
    ]);
    setInput("");
    setIsThinking(true);

    try {
      const response = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: activeModel.id,
          messages: [
            {
              role: "system",
              content:
                "당신은 공공업무를 지원하는 로컬 AI입니다. 정확하고 명확한 한국어로 답하고, 확실하지 않은 내용은 추측하지 말고 확인이 필요하다고 밝혀주세요.",
            },
            ...conversation.map((message) => ({
              role: message.role,
              content: message.text,
            })),
          ],
          stream: false,
          think: false,
          options: {
            num_ctx: 4096,
          },
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: {
          content?: string;
        };
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error || `Ollama 요청 실패 (${response.status})`);
      }

      const answer = payload.message?.content?.trim();
      if (!answer) {
        throw new Error("모델이 빈 응답을 반환했습니다.");
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: answer,
        },
      ]);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "알 수 없는 연결 오류";
      const localHint =
        window.location.protocol === "https:"
          ? "배포된 HTTPS 화면에서는 PC의 Ollama 연결이 차단될 수 있습니다. localhost 화면에서 다시 시도해주세요."
          : "Ollama가 실행 중인지, 선택한 모델이 설치돼 있는지 확인해주세요.";

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `로컬 모델과 대화하지 못했습니다.\n\n${detail}\n${localHint}`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitPrompt(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitPrompt(input);
    }
  };

  const handleFiles = (selected: FileList | null) => {
    if (!selected?.length) return;
    const added = Array.from(selected).map((file) => ({
      name: file.name,
      pages: file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)}MB` : `${Math.max(1, Math.round(file.size / 1000))}KB`,
    }));
    setFiles((current) => [...current, ...added]);
    setRightOpen(true);
  };

  const resetConversation = () => {
    setMessages([]);
    setInput("");
    setWorkspace("새 업무");
    setLeftOpen(false);
  };

  const openDiscovery = async () => {
    setModelOpen(false);
    setDiscoveryOpen(true);
    setDiscoveryState("scanning");
    setDiscoveryError("");

    const endpoints = [
      "http://127.0.0.1:11434/api/tags",
      "http://localhost:11434/api/tags",
    ];
    let lastError = "Ollama가 실행 중인지 확인해주세요.";

    for (const endpoint of endpoints) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) {
          lastError = `Ollama가 요청을 거부했습니다. (${response.status})`;
          continue;
        }

        const payload = (await response.json()) as OllamaTagsResponse;
        const models = (payload.models ?? [])
          .filter((model) => model.name || model.model)
          .map((model) => {
            const id = model.name || model.model || "unknown";
            return {
              id,
              label: formatModelLabel(id),
              runtime: "Ollama" as const,
              sizeBytes: model.size ?? 0,
              parameterSize: model.details?.parameter_size ?? "정보 없음",
              quantization: model.details?.quantization_level ?? "정보 없음",
              family: model.details?.family ?? "unknown",
            };
          })
          .sort((a, b) => {
            const aGemma4 = a.family.toLowerCase() === "gemma4" ? 0 : 1;
            const bGemma4 = b.family.toLowerCase() === "gemma4" ? 0 : 1;
            return aGemma4 - bGemma4 || a.label.localeCompare(b.label);
          });

        setDiscoveredModels(models);
        setDiscoveryState(models.length > 0 ? "found" : "error");
        if (models.length === 0) {
          setDiscoveryError("Ollama는 연결됐지만 설치된 모델이 없습니다.");
        }
        return;
      } catch (error) {
        lastError =
          error instanceof Error && error.name === "AbortError"
            ? "Ollama 응답 시간이 초과됐습니다."
            : "현재 웹 주소에서는 이 PC의 Ollama에 연결할 수 없습니다.";
      } finally {
        window.clearTimeout(timeout);
      }
    }

    setDiscoveryError(lastError);
    setDiscoveryState("error");
  };

  const useLocalModel = (model: LocalModel) => {
    setActiveModel(model);
    setDiscoveryOpen(false);
    setModelOpen(false);
  };

  return (
    <main className="app-shell">
      <aside className={`left-sidebar ${leftOpen ? "is-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>공공 AX 로컬 시리즈 1</strong>
            <small>공공업무 로컬 AI</small>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setLeftOpen(false)}
            aria-label="메뉴 닫기"
          >
            ×
          </button>
        </div>

        <button className="new-work-button" onClick={resetConversation}>
          <span aria-hidden="true">＋</span>
          새 업무 시작
          <kbd>Ctrl K</kbd>
        </button>

        <nav className="primary-nav" aria-label="주요 메뉴">
          <button className="active"><span>◫</span>업무공간</button>
          <button><span>▤</span>내 문서</button>
          <button><span>◇</span>업무도우미</button>
        </nav>

        <div className="history">
          <div className="section-label">
            <span>최근 업무</span>
            <button aria-label="최근 업무 더보기">•••</button>
          </div>
          {recentWorks.map((work, index) => (
            <button
              className={`history-item ${workspace === work.title ? "selected" : ""}`}
              key={work.title}
              onClick={() => {
                setWorkspace(work.title);
                setLeftOpen(false);
              }}
            >
              <span className={`history-dot dot-${index + 1}`} />
              <span>
                <strong>{work.title}</strong>
                <small>{work.meta}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="local-status">
            <span className="pulse-dot" />
            <div>
              <strong>로컬 보호 모드</strong>
              <small>외부 전송 없이 작동 중</small>
            </div>
          </div>
          <button className="user-row">
            <span className="avatar">김</span>
            <span><strong>김담당</strong><small>정책기획과</small></span>
            <span className="more">•••</span>
          </button>
        </div>
      </aside>

      {(leftOpen || rightOpen) && (
        <button
          className="mobile-scrim"
          aria-label="패널 닫기"
          onClick={() => {
            setLeftOpen(false);
            setRightOpen(false);
          }}
        />
      )}

      <section className="conversation-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="메뉴 열기"
            onClick={() => setLeftOpen(true)}
          >
            ☰
          </button>
          <button className="workspace-title">
            <span>{workspace}</span>
            <span className="chevron">⌄</span>
          </button>
          <div className="topbar-actions">
            <button className="discover-button" onClick={openDiscovery}>
              <span className="radar-icon" aria-hidden="true"><i /></span>
              로컬 LLM 찾기
            </button>
            <div className="model-picker">
              <button
                className="model-button"
                aria-expanded={modelOpen}
                onClick={() => setModelOpen((open) => !open)}
              >
                <span className="model-gem">◆</span>
                <span><strong>{activeModel.label}</strong><small>{activeModel.runtime} · 로컬</small></span>
                <span className="chevron">⌄</span>
              </button>
              {modelOpen && (
                <div className="model-menu">
                  <div className="model-menu-label">로컬 모델</div>
                  {(discoveredModels.length > 0 ? discoveredModels : [activeModel]).map((model) => (
                    <button
                      className={model.id === activeModel.id ? "selected" : ""}
                      key={model.id}
                      onClick={() => useLocalModel(model)}
                    >
                      <span>{model.id === activeModel.id ? "◆" : "◇"}</span>
                      <span>
                        <strong>{model.label}</strong>
                        <small>{model.runtime} · {formatBytes(model.sizeBytes)}</small>
                      </span>
                      {model.id === activeModel.id && <b>✓</b>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="status-pill"><span />오프라인</button>
            <button
              className="icon-button info-button"
              aria-label="업무 자료 열기"
              onClick={() => setRightOpen(true)}
            >
              ⓘ
            </button>
          </div>
        </header>

        <div className="conversation-scroll">
          {messages.length === 0 ? (
            <section className="welcome">
              <div className="welcome-symbol" aria-hidden="true">
                <span>◆</span>
              </div>
              <p className="welcome-kicker">안녕하세요, 김담당님</p>
              <h1>오늘은 어떤 업무를<br />함께 처리할까요?</h1>
              <p className="welcome-description">
                기관의 자료는 이 PC 안에서만 처리됩니다.<br className="desktop-break" />
                초안 작성부터 근거 확인까지 편하게 요청해보세요.
              </p>
              <div className="suggestion-grid">
                {suggestions.map((suggestion) => (
                  <button
                    className={`suggestion-card ${suggestion.tone}`}
                    key={suggestion.title}
                    onClick={() => submitPrompt(suggestion.prompt)}
                  >
                    <span className="suggestion-icon">{suggestion.eyebrow.slice(0, 1)}</span>
                    <span>
                      <small>{suggestion.eyebrow}</small>
                      <strong>{suggestion.title}</strong>
                    </span>
                    <span className="card-arrow">↗</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="messages" aria-live="polite">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className={`message-avatar ${message.role === "assistant" ? "ai" : ""}`}>
                    {message.role === "assistant" ? "◆" : "김"}
                  </div>
                  <div className="message-content">
                    <div className="message-author">
                      {message.role === "assistant" ? "로컬 AI" : "김담당"}
                    </div>
                    <p>{message.text}</p>
                    {message.sources && (
                      <div className="source-row">
                        {message.sources.map((source) => (
                          <button key={source}>▤ {source}</button>
                        ))}
                      </div>
                    )}
                    {message.role === "assistant" && (
                      <div className="message-tools">
                        <button>복사</button>
                        <button>문서로 열기</button>
                        <button>근거 확인</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {isThinking && (
                <article className="message assistant thinking">
                  <div className="message-avatar ai">◆</div>
                  <div className="thinking-bubble"><span /><span /><span /> {activeModel.label}가 응답을 생성하고 있습니다</div>
                </article>
              )}
            </section>
          )}
        </div>

        <div className="composer-wrap">
          {files.length > 0 && messages.length > 0 && (
            <div className="composer-files">
              {files.slice(-2).map((file) => <span key={file.name}>▤ {file.name}</span>)}
            </div>
          )}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="로컬 AI에게 업무를 요청하세요"
              aria-label="메시지 입력"
            />
            <div className="composer-bottom">
              <div>
                <button
                  type="button"
                  className="attach-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  ＋ <span>자료 추가</span>
                </button>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt,.xlsx,.csv"
                  onChange={(event) => handleFiles(event.target.files)}
                />
                <button type="button" className="mode-button">◎ 근거 우선</button>
              </div>
              <button
                className="send-button"
                type="submit"
                disabled={!input.trim() || isThinking}
                aria-label="메시지 보내기"
              >
                ↑
              </button>
            </div>
          </form>
          <p className="composer-note">
            AI가 생성한 내용은 부정확할 수 있습니다. 중요한 내용은 근거자료와 함께 확인하세요.
          </p>
        </div>
      </section>

      <aside className={`context-panel ${rightOpen ? "is-open" : ""}`}>
        <div className="context-header">
          <div>
            <span className="eyebrow">현재 업무공간</span>
            <h2>{workspace}</h2>
          </div>
          <button className="icon-button" aria-label="패널 닫기" onClick={() => setRightOpen(false)}>×</button>
        </div>

        <div className="security-card">
          <span className="shield">✓</span>
          <div><strong>외부 전송 없음</strong><p>모든 대화와 문서는 이 기기 안에서만 처리되고 있습니다.</p></div>
        </div>

        <section className="context-section">
          <div className="section-heading">
            <h3>참고자료 <span>{files.length}</span></h3>
            <button onClick={() => fileInputRef.current?.click()}>＋ 추가</button>
          </div>
          <div className="file-list">
            {files.map((file, index) => (
              <div className="file-item" key={`${file.name}-${index}`}>
                <span className={`file-icon ${file.name.endsWith("hwpx") ? "hwp" : ""}`}>▤</span>
                <span><strong>{file.name}</strong><small>{file.pages} · 로컬 저장</small></span>
                <button aria-label={`${file.name} 메뉴`}>•••</button>
              </div>
            ))}
          </div>
          <button className="dropzone" onClick={() => fileInputRef.current?.click()}>
            <span>＋</span>
            <strong>자료를 추가하세요</strong>
            <small>PDF, HWPX, DOCX, XLSX</small>
          </button>
        </section>

        <section className="context-section activity-section">
          <div className="section-heading"><h3>업무 상태</h3></div>
          <div className="activity-row">
            <span className="activity-icon">◎</span>
            <span><strong>근거 우선 모드</strong><small>자료에 없는 내용은 구분하여 표시</small></span>
            <span className="toggle active"><i /></span>
          </div>
          <div className="activity-row">
            <span className="activity-icon">⌁</span>
            <span><strong>자동 저장</strong><small>이 기기의 업무공간에 저장</small></span>
            <span className="toggle active"><i /></span>
          </div>
        </section>

        <div className="device-card">
          <div className="device-title"><span>◆</span><strong>{activeModel.label}</strong><small>{activeModel.quantization} · CPU</small></div>
          <div className="memory-bar">
            <span style={{ width: `${Math.min(90, Math.max(18, (activeModel.sizeBytes / 16_000_000_000) * 100))}%` }} />
          </div>
          <div className="memory-label"><span>모델 파일</span><strong>{formatBytes(activeModel.sizeBytes)}</strong></div>
        </div>
      </aside>

      {discoveryOpen && (
        <div className="discovery-overlay" role="presentation" onMouseDown={() => setDiscoveryOpen(false)}>
          <section
            className="discovery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="discovery-header">
              <div className="discovery-mark"><span /><i /></div>
              <div>
                <span className="eyebrow">내 PC에서 자동 검색</span>
                <h2 id="discovery-title">로컬 LLM 찾기</h2>
              </div>
              <button className="icon-button" aria-label="로컬 LLM 찾기 닫기" onClick={() => setDiscoveryOpen(false)}>×</button>
            </div>

            {discoveryState === "scanning" ? (
              <div className="discovery-scanning">
                <div className="scan-orbit"><span>◆</span><i /><b /></div>
                <strong>로컬 AI 환경을 확인하고 있습니다</strong>
                <p>Ollama, LM Studio, llama.cpp와 모델 폴더를 순서대로 살펴봅니다.</p>
                <div className="scan-progress"><span /></div>
              </div>
            ) : discoveryState === "found" ? (
              <>
                <div className="discovery-success">
                  <span>✓</span>
                  <div>
                    <strong>Ollama에서 {discoveredModels.length}개 모델을 찾았습니다</strong>
                    <p>사용할 모델을 선택하면 상단 모델과 현재 업무공간에 바로 반영됩니다.</p>
                  </div>
                </div>
                <div className="discovery-model-list">
                  {discoveredModels.map((model) => (
                    <div className={`discovered-model ${model.id === activeModel.id ? "active" : ""}`} key={model.id}>
                      <span className="discovered-model-icon">◆</span>
                      <span>
                        <strong>{model.label}</strong>
                        <small>{model.id} · {model.parameterSize} · {model.quantization} · {formatBytes(model.sizeBytes)}</small>
                      </span>
                      <button onClick={() => useLocalModel(model)}>
                        {model.id === activeModel.id ? "사용 중" : "사용"}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="discovery-targets compact">
                  <div><span className="target-icon">O</span><span><strong>Ollama</strong><small>설치 모델 검색 완료</small></span><b className="connected">연결됨</b></div>
                  <div><span className="target-icon lm">LM</span><span><strong>LM Studio</strong><small>다음 연결 대상</small></span><b>준비 중</b></div>
                  <div><span className="target-icon cpp">C</span><span><strong>llama.cpp · GGUF</strong><small>다음 연결 대상</small></span><b>준비 중</b></div>
                </div>
                <div className="discovery-actions">
                  <button className="secondary-action" onClick={() => setDiscoveryOpen(false)}>닫기</button>
                  <button className="primary-action" onClick={openDiscovery}>다시 찾기</button>
                </div>
              </>
            ) : (
              <>
                <div className="bridge-notice">
                  <span>!</span>
                  <div>
                    <strong>로컬 LLM을 찾지 못했습니다</strong>
                    <p>{discoveryError}</p>
                  </div>
                </div>
                <div className="discovery-targets">
                  <div><span className="target-icon">O</span><span><strong>Ollama</strong><small>기본 주소 11434 연결 실패</small></span><b>확인 필요</b></div>
                  <div><span className="target-icon lm">LM</span><span><strong>LM Studio</strong><small>다운로드 모델과 서버 확인</small></span><b>대기</b></div>
                  <div><span className="target-icon cpp">C</span><span><strong>llama.cpp · GGUF</strong><small>실행 서버와 지정 폴더 확인</small></span><b>대기</b></div>
                </div>
                <div className="discovery-actions">
                  <button className="secondary-action" onClick={() => setDiscoveryOpen(false)}>닫기</button>
                  <button className="primary-action" onClick={openDiscovery}>다시 찾기</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
