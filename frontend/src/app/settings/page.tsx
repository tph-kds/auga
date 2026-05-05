'use client';
import { useState } from 'react';
import { Settings, Brain, Cpu, Shield, Database, Save, RotateCcw } from 'lucide-react';

const DEFAULTS = {
  algorithm: 'PPO',
  device: 'cpu',
  learning_rate: 0.0003,
  n_steps: 2048,
  batch_size: 64,
  n_epochs: 10,
  gamma: 0.99,
  max_timesteps: 100000,
  validation_level: 'standard',
  sandbox_enabled: false,
  sandbox_timeout: 300,
  api_url: 'http://localhost:8000',
  auto_save_models: true,
  notify_on_complete: true,
  notify_on_error: true,
};

export default function SettingsPage() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof DEFAULTS, v: unknown) => { setCfg(c=>({...c,[k]:v})); setSaved(false); };
  const save = () => { localStorage.setItem('auga_settings', JSON.stringify(cfg)); setSaved(true); setTimeout(()=>setSaved(false),2500); };
  const reset = () => { setCfg(DEFAULTS); setSaved(false); };

  const Section = ({ icon, title, children }: { icon:JSX.Element; title:string; children:React.ReactNode }) => (
    <div className="card space-y-4">
      <h3 className="font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200 pb-2 border-b border-gray-100 dark:border-gray-700/30">
        {icon}{title}
      </h3>
      {children}
    </div>
  );

  const Field = ({ label, hint, children }: { label:string; hint?:string; children:React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );

  const Toggle = ({ value, onChange }: { value:boolean; onChange:(v:boolean)=>void }) => (
    <button onClick={()=>onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none
        ${value?'bg-orange-500':'bg-gray-300 dark:bg-gray-600'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${value?'translate-x-6':'translate-x-1'}`}/>
    </button>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Settings className="h-8 w-8 text-gray-600 dark:text-gray-400"/>Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Model hyperparameters, training config, and system preferences</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="btn btn-ghost gap-2"><RotateCcw className="h-4 w-4"/>Reset</button>
          <button onClick={save} className={`btn ${saved?'btn-secondary':'btn-primary'} gap-2`}>
            {saved ? <>✓ Saved!</> : <><Save className="h-4 w-4"/>Save</>}
          </button>
        </div>
      </div>

      {/* Algorithm & Training */}
      <Section icon={<Brain className="h-5 w-5 text-blue-500"/>} title="Training Defaults">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Algorithm">
            <select value={cfg.algorithm} onChange={e=>set('algorithm',e.target.value)} className="input">
              <option value="PPO">PPO (Recommended)</option>
              <option value="A2C">A2C</option>
              <option value="DQN">DQN</option>
            </select>
          </Field>
          <Field label="Device" hint="CPU recommended for low VRAM">
            <select value={cfg.device} onChange={e=>set('device',e.target.value)} className="input">
              <option value="cpu">CPU</option>
              <option value="cuda">CUDA (GPU)</option>
            </select>
          </Field>
        </div>
        <Field label={`Max Timesteps: ${new Intl.NumberFormat('en-US').format(cfg.max_timesteps)}`}>
          <input type="range" min={1000} max={1000000} step={1000} value={cfg.max_timesteps}
            onChange={e=>set('max_timesteps',+e.target.value)} className="w-full accent-orange-500"/>
        </Field>
      </Section>

      {/* Hyperparameters */}
      <Section icon={<Cpu className="h-5 w-5 text-purple-500"/>} title="Hyperparameters">
        <div className="grid grid-cols-2 gap-4">
          {[
            { key:'learning_rate' as const, label:'Learning Rate', min:0.00001, max:0.01, step:0.00001 },
            { key:'gamma' as const,         label:'Gamma (Discount)', min:0.9, max:0.999, step:0.001 },
          ].map(f=>(
            <Field key={f.key} label={`${f.label}: ${Number(cfg[f.key]).toFixed(5)}`}>
              <input type="range" min={f.min} max={f.max} step={f.step} value={cfg[f.key] as number}
                onChange={e=>set(f.key,+e.target.value)} className="w-full accent-purple-500"/>
            </Field>
          ))}
          <Field label="N Steps">
            <input type="number" value={cfg.n_steps} onChange={e=>set('n_steps',+e.target.value)} className="input"/>
          </Field>
          <Field label="Batch Size">
            <input type="number" value={cfg.batch_size} onChange={e=>set('batch_size',+e.target.value)} className="input"/>
          </Field>
          <Field label="N Epochs">
            <input type="number" value={cfg.n_epochs} onChange={e=>set('n_epochs',+e.target.value)} className="input"/>
          </Field>
        </div>
      </Section>

      {/* Safety */}
      <Section icon={<Shield className="h-5 w-5 text-green-500"/>} title="Safety & Validation">
        <Field label="Validation Level">
          <select value={cfg.validation_level} onChange={e=>set('validation_level',e.target.value)} className="input">
            <option value="permissive">Permissive</option>
            <option value="standard">Standard (Recommended)</option>
            <option value="strict">Strict</option>
          </select>
        </Field>
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <div>
            <p className="text-sm font-medium">Docker Sandbox</p>
            <p className="text-xs text-gray-500">Isolated execution environment</p>
          </div>
          <Toggle value={cfg.sandbox_enabled} onChange={v=>set('sandbox_enabled',v)}/>
        </div>
        {cfg.sandbox_enabled && (
          <Field label={`Sandbox Timeout: ${cfg.sandbox_timeout}s`}>
            <input type="range" min={30} max={3600} step={30} value={cfg.sandbox_timeout}
              onChange={e=>set('sandbox_timeout',+e.target.value)} className="w-full accent-green-500"/>
          </Field>
        )}
      </Section>

      {/* System */}
      <Section icon={<Database className="h-5 w-5 text-orange-500"/>} title="System">
        <Field label="Backend API URL">
          <input type="text" value={cfg.api_url} onChange={e=>set('api_url',e.target.value)} className="input"/>
        </Field>
        {[
          { key:'auto_save_models' as const, label:'Auto-save Models', desc:'Automatically save models after training' },
          { key:'notify_on_complete' as const, label:'Notify on Completion', desc:'Push notification when pipeline succeeds' },
          { key:'notify_on_error' as const, label:'Notify on Error', desc:'Push notification on pipeline failure' },
        ].map(s=>(
          <div key={s.key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div>
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </div>
            <Toggle value={cfg[s.key] as boolean} onChange={v=>set(s.key,v)}/>
          </div>
        ))}
      </Section>
    </div>
  );
}
