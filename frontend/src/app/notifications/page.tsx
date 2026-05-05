'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, RefreshCw, AlertCircle, CheckCircle, Info, AlertTriangle, Filter } from 'lucide-react';

interface Notif { id:number; workflow_id?:string; level:string; title:string; message:string; category:string; read:boolean; created_at:string }

const API = 'http://localhost:8000';
const LEVEL_ICON: Record<string,JSX.Element> = {
  success: <CheckCircle  className="h-5 w-5 text-green-500 flex-shrink-0"/>,
  error:   <AlertCircle className="h-5 w-5 text-red-500   flex-shrink-0"/>,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0"/>,
  info:    <Info          className="h-5 w-5 text-blue-500  flex-shrink-0"/>,
};
const LEVEL_BG: Record<string,string> = {
  success:'bg-green-50  dark:bg-green-950/20  border-green-100  dark:border-green-800/30',
  error:  'bg-red-50    dark:bg-red-950/20    border-red-100    dark:border-red-800/30',
  warning:'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-100 dark:border-yellow-800/30',
  info:   'bg-blue-50   dark:bg-blue-950/20   border-blue-100   dark:border-blue-800/30',
};
const CAT_COLORS: Record<string,string> = {
  pipeline:'badge-orange',training:'badge-blue',eval:'badge-purple',error:'badge-red',system:'badge-gray',
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<'all'|'unread'|'success'|'error'>('all');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/notifications?limit=100&unread_only=${filter==='unread'}`);
      if (r.ok) { const d=await r.json(); setItems(d.notifications); setUnread(d.unread_count); }
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id:number) => {
    await fetch(`${API}/notifications/${id}/read`, {method:'PATCH'});
    setItems(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));
    setUnread(c=>Math.max(0,c-1));
  };

  const markAllRead = async () => {
    await fetch(`${API}/notifications/read-all`, {method:'POST'});
    setItems(prev=>prev.map(n=>({...n,read:true}))); setUnread(0);
  };

  const del = async (id:number) => {
    await fetch(`${API}/notifications/${id}`, {method:'DELETE'});
    setItems(prev=>prev.filter(n=>n.id!==id));
  };

  const clearAll = async () => {
    if (!confirm('Clear all notifications?')) return;
    await fetch(`${API}/notifications`, {method:'DELETE'});
    setItems([]); setUnread(0);
  };

  const filtered = items.filter(n => {
    if (filter==='unread') return !n.read;
    if (filter==='success') return n.level==='success';
    if (filter==='error') return n.level==='error';
    return true;
  });

  const fmt = (iso:string) => {
    const d=new Date(iso);
    const now=new Date();
    const diff=now.getTime()-d.getTime();
    if (diff<60000) return 'just now';
    if (diff<3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff<86400000) return `${Math.floor(diff/3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-500"/>Notifications
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Pipeline events, training milestones, and system alerts · {unread} unread
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-ghost gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>
          </button>
          {unread>0 && (
            <button onClick={markAllRead} className="btn btn-ghost gap-2 text-sm">
              <CheckCheck className="h-4 w-4"/>Mark all read
            </button>
          )}
          {items.length>0 && (
            <button onClick={clearAll} className="btn btn-ghost gap-2 text-sm text-red-500 hover:text-red-600">
              <Trash2 className="h-4 w-4"/>Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all','unread','success','error'] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
              ${filter===f?'bg-orange-500 text-white shadow-md shadow-orange-500/20':'btn-ghost'}`}>
            {f==='all'?`All (${items.length})`:f==='unread'?`Unread (${unread})`:f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length===0 ? (
        <div className="card text-center py-20">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4"/>
          <p className="text-gray-400 font-medium">No notifications</p>
          <p className="text-sm text-gray-400 mt-1">Pipeline events will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n=>(
            <div key={n.id}
              className={`group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer
                ${LEVEL_BG[n.level]||LEVEL_BG.info}
                ${n.read?'opacity-70':''}`}
              onClick={()=>!n.read&&markRead(n.id)}
            >
              {LEVEL_ICON[n.level]||LEVEL_ICON.info}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{n.title}</p>
                  <span className={`badge ${CAT_COLORS[n.category]||'badge-gray'} text-[10px]`}>{n.category}</span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0"/>}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-gray-400">{fmt(n.created_at)}</span>
                  {n.workflow_id && <span className="text-xs font-mono text-gray-400 truncate max-w-[180px]">{n.workflow_id}</span>}
                </div>
              </div>
              <button onClick={e=>{e.stopPropagation();del(n.id);}}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all">
                <Trash2 className="h-4 w-4"/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
