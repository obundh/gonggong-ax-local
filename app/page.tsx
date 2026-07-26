"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: string[];
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

const firstAssistantMessage =
  "좋습니다. 현재 업무공간에 등록된 자료를 우선 확인한 뒤, 근거가 확인되는 내용과 검토가 필요한 내용을 구분해 작성하겠습니다.\n\n초안은 ① 검토 배경 ② 주요 내용 ③ 쟁점 및 검토의견 ④ 향후 조치 순으로 구성하겠습니다.";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [workspace, setWorkspace] = useState("새 업무");
  const [files, setFiles] = useState([
    { name: "2026년 업무계획.pdf", pages: "12쪽" },
    { name: "검토보고서 서식.hwpx", pages: "서식" },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitPrompt = (prompt: string) => {
    const clean = prompt.trim();
    if (!clean || isThinking) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: clean },
    ]);
    setInput("");
    setIsThinking(true);

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: firstAssistantMessage,
          sources: ["2026년 업무계획.pdf · 3쪽", "검토보고서 서식.hwpx"],
        },
      ]);
      setIsThinking(false);
    }, 650);
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
            <strong>갈라파고스</strong>
            <small>공공 AI 워크스페이스</small>
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
            <div className="model-picker">
              <button
                className="model-button"
                aria-expanded={modelOpen}
                onClick={() => setModelOpen((open) => !open)}
              >
                <span className="model-gem">◆</span>
                <span><strong>Gemma 4 E2B</strong><small>빠른 응답</small></span>
                <span className="chevron">⌄</span>
              </button>
              {modelOpen && (
                <div className="model-menu">
                  <div className="model-menu-label">로컬 모델</div>
                  <button className="selected">
                    <span>◆</span><span><strong>Gemma 4 E2B</strong><small>현재 PC에 최적화</small></span><b>✓</b>
                  </button>
                  <button disabled>
                    <span>◇</span><span><strong>Gemma 4 E4B</strong><small>추가 설치 필요</small></span>
                  </button>
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
                      {message.role === "assistant" ? "갈라파고스" : "김담당"}
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
                  <div className="thinking-bubble"><span /><span /><span /> 자료를 확인하고 있습니다</div>
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
              placeholder="갈라파고스에게 업무를 요청하세요"
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
          <div className="device-title"><span>◆</span><strong>Gemma 4 E2B</strong><small>Q4 · CPU</small></div>
          <div className="memory-bar"><span /></div>
          <div className="memory-label"><span>메모리 사용량</span><strong>4.8 / 16 GB</strong></div>
        </div>
      </aside>
    </main>
  );
}
