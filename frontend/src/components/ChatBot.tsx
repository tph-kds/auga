'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Bot, User, Play, Loader2 } from 'lucide-react';
import { Button } from './UI';
import type { StatusResponse } from '@/types/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'running' | 'complete' | 'error';
  workflowId?: string;
}

export interface ChatBotProps {
  onTaskStart?: (taskId: string) => void;
}

export default function ChatBot({ onTaskStart }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send to agent endpoint (new /chat)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content })
      });

      if (!response.ok) throw new Error('Agent error');

      const data = await response.json();
      const assistantMessage: Message = {
        id: `agent_${Date.now()}`,
        role: 'assistant',
        content: data.response || 'Task started.',
        timestamp: new Date(),
        workflowId: data.workflow_id,
        status: data.status || 'running'
      };

      setMessages(prev => [...prev, assistantMessage]);
      onTaskStart?.(data.workflow_id || '');

    } catch (error) {
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${(error as Error).message}`,
        timestamp: new Date(),
        status: 'error'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-lg border">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-t-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI Agent Assistant</h2>
            <p className="text-sm text-gray-500">Send me training requests. I'll handle data, training, fine-tuning, and gameplay.</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
            <p className="max-w-md mx-auto">
              Ask me to "play AngryBird to 10 scores" or "collect data for target 20". I'll 
              automatically collect data, train, fine-tune, and play to achieve it.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl p-4 rounded-2xl shadow ${
                message.role === 'user' 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
              } ${message.status === 'error' ? 'border-2 border-red-200 dark:border-red-800' : ''}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.status && (
                  <div className="mt-2 flex items-center space-x-2 text-xs opacity-80">
                    {message.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {message.status === 'complete' && <Play className="h-3 w-3" />}
                    <span>{message.status}</span>
                  </div>
                )}
                <div className="mt-1 text-xs opacity-60">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t bg-gray-50 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a request to your agent... (e.g. play to 10 scores)"
            className="flex-1 input px-4 py-3 focus:ring-2 focus:ring-primary-500"
            disabled={isLoading}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!input.trim() || isLoading}
            className="px-6 flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Agent will automatically collect data, train, fine-tune, and play games to achieve your request
        </p>
      </div>
    </div>
  );
}

