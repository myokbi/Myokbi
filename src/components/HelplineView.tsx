import React, { useRef, useState } from 'react';
import { ImagePlus, Send } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { MemberStateResponse } from '../types';

interface HelplineViewProps {
  data: MemberStateResponse;
  onRefresh: () => Promise<void>;
}

const TOPICS = [
  'উইথড্র সমস্যা',
  'সেন্ড মানি সমস্যা',
  'কাজের সমস্যা',
  'প্রিমিয়াম সমস্যা',
  'ডিপোজিট সমস্যা',
];

export default function HelplineView({ data, onRefresh }: HelplineViewProps) {
  const [selectedTopic, setSelectedTopic] = useState('উইথড্র সমস্যা');
  const [text, setText] = useState('');
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiRequest('/api/helpline/messages', {
        method: 'POST',
        body: JSON.stringify({
          topic: selectedTopic,
          text: text.trim(),
          fileUrl: fileDataUrl,
        }),
      });
      setText('');
      setFileDataUrl(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await onRefresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="surface-card overflow-hidden flex flex-col min-h-[540px]">
      <div className="px-5 py-4 bg-[#0b1220] text-white flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">OKB Live Support</h2>
          <p className="text-xs text-emerald-400 font-medium">Server Agent Desk · 30-minute auto-cleanup</p>
        </div>
        <span className="text-xs text-slate-300 font-mono-num">{data.helplineMessages.length} msgs</span>
      </div>

      {/* Topic Selector */}
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-600 mb-2">আপনার সমস্যাটি সিলেক্ট করুন:</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setSelectedTopic(topic)}
              className={selectedTopic === topic ? 'btn-obsidian btn-sm' : 'btn-secondary btn-sm'}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[380px] bg-[#f3f5f8]">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 text-center">
          স্বাগতম! OKB সাপোর্টে আপনার সমস্যাটি সিলেক্ট করে মেসেজ করুন।
        </div>

        {data.helplineMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'User' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                msg.sender === 'User'
                  ? 'bg-emerald-700 text-white'
                  : msg.sender === 'Agent'
                  ? 'bg-white border border-slate-200 text-slate-900'
                  : 'bg-slate-900 text-slate-100'
              }`}
            >
              {msg.sender === 'Agent' && <p className="font-bold text-emerald-700 mb-0.5">Support Agent</p>}
              <p>{msg.text}</p>
              {msg.fileUrl && (
                <img
                  src={msg.fileUrl}
                  alt="Uploaded attachment"
                  className="mt-2 max-w-[200px] rounded-lg border border-black/10"
                />
              )}
              <p
                className={`text-[10px] mt-1 font-mono-num ${
                  msg.sender === 'User' ? 'text-emerald-100' : 'text-slate-400'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
        <label
          title="Attach Image"
          className={`min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
            fileDataUrl
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
              : 'bg-white border-slate-300 text-slate-600 hover:border-slate-500'
          }`}
        >
          <ImagePlus className="w-4 h-4" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="আপনার মেসেজ লিখুন..."
          className="input-atelier"
          required
        />
        <button
          type="submit"
          disabled={sending}
          aria-label="Send message"
          className="btn-primary px-4"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}
