'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// チケットの型定義
interface Ticket {
  id: string;
  title: string;
  category: string;
  description: string;
  status: string;
  metoo_count: number;
  created_at: string;
  reactions?: {
    wai_count: number;
    yoshi_count: number;
  };
}

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Edge タスク');
  const [description, setDescription] = useState('');

  // 1. データベースからチケット一覧を取得
  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        reactions (
          wai_count,
          yoshi_count
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('データ取得エラー:', error);
    } else if (data) {
      // Supabaseの結合データの型を調整してステートに保存
      const formatted = data.map((t: any) => ({
        ...t,
        reactions: t.reactions ? t.reactions : { wai_count: 0, yoshi_count: 0 }
      }));
      setTickets(formatted);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // 2. 新規不具合チケットの投稿
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return alert('タイトルと詳細を入力してください');

    const { error } = await supabase
      .from('tickets')
      .insert([{ title, category, description }]);

    if (error) {
      alert('投稿に失敗しました: ' + error.message);
    } else {
      setTitle('');
      setDescription('');
      fetchTickets(); // 一覧を再更新
    }
  };

  // 3. MeToo（共感）のカウントアップ
  const handleMeToo = async (id: string, currentCount: number) => {
    const { error } = await supabase
      .from('tickets')
      .update({ metoo_count: currentCount + 1 })
      .eq('id', id);

    if (!error) fetchTickets();
  };

  // 4. リアクション（ワイも / よしよし）のカウントアップ
  const handleReaction = async (id: string, type: 'wai_count' | 'yoshi_count', currentCount: number) => {
    const { error } = await supabase
      .from('reactions')
      .update({ [type]: currentCount + 1 })
      .eq('ticket_id', id);

    if (!error) fetchTickets();
  };

  // 5. ステータス変更（解決 ➔ 自動アーカイブの実験用）
  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) fetchTickets();
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800">
      <div className="max-w-4xl mx-auto">
        
        {/* ヘッダー */}
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            📘 Rewards 不具合コミュニティサイト <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded">v1 Mock</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">ここは「戦友の集まる場所」です。否定しない、助け合いの場所。</p>
        </header>

        {/* 投稿フォーム */}
        <section className="bg-white p-6 rounded-lg shadow-sm border mb-8">
          <h2 className="text-lg font-semibold mb-4">🛠️ 不具合を報告する（新規チケット作成）</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
                placeholder="例：デイリーセットが完了にならない"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">カテゴリ（ラベル）</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm bg-white focus:outline-blue-500"
              >
                <option>Edge タスク</option>
                <option>Bing App タスク</option>
                <option>ゲームプレイ</option>
                <option>検索タスク</option>
                <option>デイリーセット</option>
                <option>ストリーク</option>
                <option>その他</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">症状の詳細</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
                placeholder="どのような現象が起きていますか？"
              />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded text-sm transition-colors">
              チケットを作成
            </button>
          </form>
        </section>

        {/* チケット一覧（ダッシュボード） */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">📋 ダッシュボード（最新のチケット）</h2>
          
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-400 border border-dashed rounded p-8 text-center bg-white">
              まだチケットがありません。上のフォームから最初の不具合を投稿してみましょう！
            </p>
          ) : (
            tickets.map((ticket) => {
              // 仕様書「7. アーカイブ」：解決時は背景を薄い灰色にする
              const isResolved = ticket.status === 'Resolved';
              
              return (
                <div 
                  key={ticket.id} 
                  className={`p-6 rounded-lg border transition-all shadow-sm ${
                    isResolved ? 'bg-slate-200 border-slate-300 opacity-75' : 'bg-white border-slate-200'
                  }`}
                >
                  {/* チケットヘッダー */}
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <div>
                      <span className="text-xs bg-slate-100 border text-slate-600 px-2 py-0.5 rounded mr-2 font-mono">
                        {ticket.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                        isResolved ? 'bg-slate-400 text-white' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isResolved ? '📁 Resolved (Archived)' : `⏳ ${ticket.status}`}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* タイトルと詳細 */}
                  <h3 className={`text-base font-bold mb-2 ${isResolved ? 'line-through text-slate-500' : ''}`}>
                    {isResolved ? '📁 ' : ''}{ticket.title}
                  </h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap mb-4">{ticket.description}</p>

                  {/* アクションエリア */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-3">
                    
                    {/* 仕様書ベースのコミュニケーションボタン群 */}
                    <div className="flex items-center gap-2">
                      {/* MeToo ボタン */}
                      <button 
                        onClick={() => handleMeToo(ticket.id, ticket.metoo_count)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                      >
                        MeToo 🙋‍♂️ <span className="font-bold bg-red-200 px-1.5 py-0.5 rounded-full text-[10px]">{ticket.metoo_count}</span>
                      </button>

                      {/* ワイも ボタン */}
                      <button 
                        onClick={() => handleReaction(ticket.id, 'wai_count', ticket.reactions?.wai_count || 0)}
                        disabled={isResolved}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="同じ状況だよ"
                      >
                        ワイも 🙋‍♂️ <span className="font-bold bg-amber-200 px-1.5 py-0.5 rounded-full text-[10px]">{ticket.reactions?.wai_count || 0}</span>
                      </button>

                      {/* よしよし ボタン */}
                      <button 
                        onClick={() => handleReaction(ticket.id, 'yoshi_count', ticket.reactions?.yoshi_count || 0)}
                        disabled={isResolved}
                        className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="つらかったね"
                      >
                        よしよし 🤲 <span className="font-bold bg-teal-200 px-1.5 py-0.5 rounded-full text-[10px]">{ticket.reactions?.yoshi_count || 0}</span>
                      </button>
                    </div>

                    {/* ステータス変更トグル（モック確認用） */}
                    <div>
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1 bg-white focus:outline-none"
                      >
                        <option value="Submitted">Submitted (新規)</option>
                        <option value="Investigating">Investigating (調査中)</option>
                        <option value="Resolved">Resolved (解決・アーカイブ)</option>
                      </select>
                    </div>

                  </div>

                </div>
              );
            })
          )}
        </section>

      </div>
    </main>
  );
}