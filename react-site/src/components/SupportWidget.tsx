import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Headset, LoaderCircle, MessageCircleWarning, SendHorizontal, X } from 'lucide-react';
import { API, type SupportConversation, type SupportMessage } from '../api';
import './SupportWidget.css';

interface SupportWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

const CLIENT_STORAGE_KEY = 'neuralv_support_client_id';

function getSupportClientId() {
  const existing = localStorage.getItem(CLIENT_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextId =
    window.crypto?.randomUUID?.() ||
    `support-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  localStorage.setItem(CLIENT_STORAGE_KEY, nextId);
  return nextId;
}

function mergeMessages(current: SupportMessage[], incoming: SupportMessage[]) {
  const map = new Map<number, SupportMessage>();

  [...current, ...incoming].forEach((message) => {
    map.set(message.id, message);
  });

  return Array.from(map.values()).sort((left, right) => left.id - right.id);
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const SupportWidget: React.FC<SupportWidgetProps> = ({ isOpen, onClose }) => {
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [error, setError] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const clientId = useMemo(() => getSupportClientId(), []);
  const userId = localStorage.getItem('neuralv_id');
  const displayName = localStorage.getItem('neuralv_username') || 'Гость';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const bootstrap = async () => {
      setIsBooting(true);
      setError('');

      try {
        const response = await API.initSupportSession(clientId, userId, displayName);
        if (!response.success) {
          setConversation(null);
          setMessages([]);
          setError(response.message || 'Не удалось открыть диалог поддержки.');
          return;
        }

        setConversation(response.conversation);
        setMessages(response.messages || []);
        if (response.retryAfterMs) {
          setCooldownUntil(Date.now() + response.retryAfterMs);
        }
      } catch (bootError) {
        console.error(bootError);
        setError('Сервис поддержки временно недоступен.');
      } finally {
        setIsBooting(false);
      }
    };

    void bootstrap();
  }, [clientId, displayName, isOpen, userId]);

  useEffect(() => {
    if (!isOpen || cooldownUntil <= Date.now()) {
      return;
    }

    const interval = window.setInterval(() => {
      const nextTick = Date.now();
      setTick(nextTick);

      if (nextTick >= cooldownUntil) {
        window.clearInterval(interval);
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [cooldownUntil, isOpen]);

  useEffect(() => {
    if (!isOpen || !conversation) {
      return;
    }

    const stream = new EventSource(API.buildSupportStreamUrl(conversation.id, clientId));

    stream.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data) as SupportMessage;
      setMessages((current) => mergeMessages(current, [payload]));
    });

    stream.onerror = () => {
      stream.close();
    };

    return () => stream.close();
  }, [clientId, conversation, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - tick) / 1000));
  const isCooldown = cooldownLeft > 0;

  const handleSend = async () => {
    if (!conversation || !draft.trim() || isCooldown || isLoading) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await API.sendSupportMessage({
        conversationId: conversation.id,
        clientId,
        userId,
        displayName,
        text: draft.trim(),
      });

      if (!response.success) {
        if (response.status === 429 && response.retryAfterMs) {
          setCooldownUntil(Date.now() + response.retryAfterMs);
        }
        setError(response.message || 'Не удалось отправить сообщение.');
        return;
      }

      if (response.message) {
        setMessages((current) => mergeMessages(current, [response.message]));
      }

      setDraft('');
      setCooldownUntil(Date.now() + (response.retryAfterMs || 0));
    } catch (sendError) {
      console.error(sendError);
      setError('Не удалось отправить сообщение.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="support-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="support-widget glass-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="support-header">
              <div className="support-title-group">
                <div className="support-icon-shell">
                  <Headset size={18} />
                </div>
                <div>
                  <h3>Поддержка</h3>
                  <p>{conversation?.publicId ? `Диалог ${conversation.publicId}` : 'Прямо на сайте'}</p>
                </div>
              </div>
              <button type="button" className="support-close" onClick={onClose} aria-label="Закрыть">
                <X size={18} />
              </button>
            </header>

            <div className="support-status-bar">
              <span>Мы ответим сюда же, без перехода в Telegram.</span>
              {isCooldown && <strong>Пауза {cooldownLeft} сек</strong>}
            </div>

            <div className="support-messages">
              {isBooting ? (
                <div className="support-empty-state">
                  <LoaderCircle className="spin" size={24} />
                  <p>Открываем диалог поддержки...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="support-empty-state">
                  <MessageCircleWarning size={24} />
                  <p>Напишите вопрос, и сообщение уйдёт в Telegram-команду поддержки.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isUserMessage = message.senderType === 'user';

                  return (
                    <article
                      key={message.id}
                      className={`support-message ${isUserMessage ? 'outgoing' : 'incoming'}`}
                    >
                      <div className="support-message-meta">
                        <span>{isUserMessage ? 'Вы' : message.senderName || 'Поддержка'}</span>
                        <time>{formatMessageTime(message.createdAt)}</time>
                      </div>
                      <p>{message.text}</p>
                    </article>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer className="support-footer">
              {error && <div className="support-error">{error}</div>}
              <div className="support-composer">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Опишите проблему или задайте вопрос..."
                  maxLength={2000}
                  rows={4}
                  className="support-textarea"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <button
                  type="button"
                  className="support-send"
                  onClick={() => void handleSend()}
                  disabled={isLoading || isCooldown || !draft.trim()}
                >
                  {isLoading ? <LoaderCircle className="spin" size={18} /> : <SendHorizontal size={18} />}
                  <span>{isCooldown ? `Ждите ${cooldownLeft} сек` : 'Отправить'}</span>
                </button>
              </div>
              <div className="support-hint">Ctrl + Enter отправляет сообщение</div>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SupportWidget;
