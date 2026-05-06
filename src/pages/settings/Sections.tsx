import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, Crown, Globe, Key, Smartphone, Shield, Activity, Monitor, Code, Mail, AlertTriangle, Download, Star } from 'lucide-react';
import { Card, Input, Button, Toggle } from './SettingsComponents';
import { MockApi } from './MockApi';

export const IdentitySection = ({ initialData, addToast }: any) => {
  const [data, setData] = useState(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setData({ ...data, [e.target.name]: e.target.value });
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await MockApi.updateProfile(data);
      addToast('success', 'Profile identity updated successfully.');
      setIsDirty(false);
    } catch (e: any) {
      addToast('error', e.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card title="Profile Identity" description="Manage your public-facing information and contact details.">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex flex-col items-center gap-4 shrink-0">
          <div className="relative group cursor-pointer">
            <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-blue-500/50 transition-colors">
              <img src={data.avatarUrl || "https://api.dicebear.com/7.x/notionists/svg?seed=Felix"} alt="Profile" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={24} className="text-white" />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Crown size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest">Elite Member</span>
            </div>
            <span className="text-xs text-zinc-500 font-medium mt-1">Joined May 2026</span>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Full Name" name="fullName" value={data.fullName} onChange={handleChange} placeholder="Enter your full name" />
            <Input label="Display Name" name="username" value={data.username} onChange={handleChange} placeholder="@username" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <Input label="Email Address" name="email" value={data.email} onChange={handleChange} type="email" />
              <div className="absolute right-4 top-9 text-emerald-500" title="Verified">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <Input label="Phone Number" name="phone" value={data.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex justify-between">
              <span>Short Bio</span>
              <span className={`${data.bio?.length > 120 ? 'text-rose-500' : 'text-zinc-600'}`}>{data.bio?.length || 0} / 120</span>
            </label>
            <textarea 
              name="bio"
              value={data.bio}
              onChange={handleChange}
              rows={3}
              maxLength={120}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none custom-scrollbar"
              placeholder="A little bit about yourself..."
            />
          </div>

          <AnimatePresence>
            {isDirty && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex justify-end pt-2 overflow-hidden">
                <Button onClick={handleSave} isLoading={isSaving}>Save Identity Changes</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
};

export const ProductivitySection = ({ initialData, addToast }: any) => {
  const [data, setData] = useState(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateField = (field: string, value: any) => {
    setData({ ...data, [field]: value });
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await MockApi.updateProductivity(data);
      addToast('success', 'Productivity profile updated.');
      setIsDirty(false);
    } catch (e) {
      addToast('error', 'Failed to save productivity profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const interests = ['Fitness', 'Reading', 'Career', 'Finance', 'Learning', 'Health', 'Coding', 'Mindfulness'];

  return (
    <Card title="Productivity Profile" description="Tune the AI engine to your unique working style and goals.">
      <div className="space-y-8">
        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 block mb-4">Preferred Work Time</label>
          <div className="flex flex-wrap gap-3">
            {['Morning', 'Afternoon', 'Night'].map(t => (
              <button key={t} onClick={() => updateField('workTime', t)} className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${data.workTime === t ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 block mb-4">Productivity Style</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { id: 'deep_work', label: 'Deep Work', desc: 'Long, uninterrupted focus blocks' },
              { id: 'flexible', label: 'Flexible', desc: 'Adaptable schedule, fluid tasks' },
              { id: 'sprint', label: 'Sprint Mode', desc: 'Short, intense bursts of activity' }
            ].map(s => (
              <div key={s.id} onClick={() => updateField('style', s.id)} className={`p-5 rounded-2xl border cursor-pointer transition-all ${data.style === s.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                <p className={`text-sm font-bold mb-1 ${data.style === s.id ? 'text-blue-400' : 'text-white'}`}>{s.label}</p>
                <p className="text-[11px] text-zinc-500 leading-tight">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 block mb-4">Goal Interests</label>
          <div className="flex flex-wrap gap-2">
            {interests.map(i => {
              const isSelected = data.interests?.includes(i);
              return (
                <button key={i} onClick={() => {
                  const newInterests = isSelected ? data.interests.filter((x: string) => x !== i) : [...data.interests, i];
                  updateField('interests', newInterests);
                }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-white/10 text-zinc-400 hover:border-white/30'}`}>
                  {i}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <Toggle 
            checked={data.aiPersonalization} 
            onChange={(v) => updateField('aiPersonalization', v)} 
            label="AI Personalization Engine" 
            description="Allow GYG's Neural Synergy to dynamically adjust your roadmap based on your productivity patterns."
          />
        </div>

        <AnimatePresence>
          {isDirty && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex justify-end pt-4 overflow-hidden">
              <Button onClick={handleSave} isLoading={isSaving}>Save Preferences</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};

export const SecuritySection = ({ addToast }: any) => {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdData, setPwdData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdError, setPwdError] = useState('');
  const [is2FA, setIs2FA] = useState(false);
  const [sessions, setSessions] = useState([
    { id: '1', device: 'MacBook Pro', browser: 'Chrome 124.0', location: 'San Francisco, CA', active: true },
    { id: '2', device: 'iPhone 15 Pro', browser: 'Safari Mobile', location: 'San Francisco, CA', active: false, lastActive: '2 hours ago' }
  ]);

  const handlePasswordSubmit = async () => {
    if (pwdData.newPassword !== pwdData.confirmPassword) {
      setPwdError("Passwords do not match");
      return;
    }
    if (pwdData.newPassword.length < 8) {
      setPwdError("Password must be at least 8 characters");
      return;
    }
    setPwdError('');
    setIsChangingPassword(true);
    try {
      await MockApi.changePassword(pwdData);
      addToast('success', 'Password updated successfully.');
      setPwdData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      setPwdError(e.message || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutSession = async (id: string) => {
    try {
      await MockApi.logoutSession(id);
      setSessions(sessions.filter(s => s.id !== id));
      addToast('success', 'Session terminated.');
    } catch (e) {
      addToast('error', 'Failed to terminate session.');
    }
  };

  return (
    <Card title="Security & Access" description="Protect your account and manage active sessions.">
      <div className="space-y-10">
        
        {/* Password */}
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold mb-1">Password</h3>
              <p className="text-sm text-zinc-500">Ensure your account is using a long, random password to stay secure.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl"><Key size={20} className="text-zinc-400" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input type="password" label="Current Password" value={pwdData.currentPassword} onChange={e => setPwdData({...pwdData, currentPassword: e.target.value})} placeholder="••••••••" />
            <div />
            <Input type="password" label="New Password" value={pwdData.newPassword} onChange={e => setPwdData({...pwdData, newPassword: e.target.value})} placeholder="••••••••" />
            <Input type="password" label="Confirm Password" value={pwdData.confirmPassword} onChange={e => setPwdData({...pwdData, confirmPassword: e.target.value})} placeholder="••••••••" error={pwdError} />
          </div>
          {pwdData.currentPassword && pwdData.newPassword && (
            <div className="flex justify-end pt-2">
               <Button onClick={handlePasswordSubmit} isLoading={isChangingPassword}>Update Password</Button>
            </div>
          )}
        </div>

        {/* 2FA */}
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
          <Toggle 
            checked={is2FA} 
            onChange={async (v) => {
              try {
                await MockApi.toggle2FA(v);
                setIs2FA(v);
                addToast('success', `2FA ${v ? 'enabled' : 'disabled'}`);
              } catch (e) {}
            }} 
            label="Two-Factor Authentication (2FA)" 
            description="Add an extra layer of security to your account using an authenticator app."
          />
        </div>

        {/* Sessions */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 block mb-4">Active Sessions</label>
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-black/20">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/5 rounded-xl">
                    {s.device.includes('iPhone') ? <Smartphone size={18} className="text-zinc-400" /> : <Monitor size={18} className="text-zinc-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      {s.device} {s.active && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 uppercase tracking-widest">Active Now</span>}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{s.browser} • {s.location}</p>
                  </div>
                </div>
                {!s.active && (
                  <button onClick={() => handleLogoutSession(s.id)} className="text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-500/10">
                    Log out
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </Card>
  );
};

export const ConnectionsSection = ({ addToast }: any) => {
  const [connections, setConnections] = useState<Record<string, boolean>>({
    google: true,
    github: false,
    apple: false
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const toggleConnection = async (provider: string) => {
    setLoading({ ...loading, [provider]: true });
    try {
      const isConnected = connections[provider];
      if (isConnected) {
        await MockApi.disconnectOAuth(provider);
        setConnections({ ...connections, [provider]: false });
      } else {
        await MockApi.connectOAuth(provider);
        setConnections({ ...connections, [provider]: true });
      }
    } catch (e) {
      addToast('error', `Failed to update ${provider} connection.`);
    } finally {
      setLoading({ ...loading, [provider]: false });
    }
  };

  const providers = [
    { id: 'google', name: 'Google', icon: Mail, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    { id: 'github', name: 'GitHub', icon: Code, color: 'text-white', bg: 'bg-white/10', border: 'border-white/20' },
    { id: 'apple', name: 'Apple', icon: Globe, color: 'text-zinc-300', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
  ];

  return (
    <Card title="Connected Accounts" description="Link your external accounts for easier login and integration.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map(p => {
          const isConnected = connections[p.id];
          return (
            <div key={p.id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center gap-4 hover:bg-white/[0.04] transition-colors">
              <div className={`p-4 rounded-2xl ${p.bg} ${p.border} border`}>
                <p.icon size={28} className={p.color} />
              </div>
              <div>
                <h4 className="text-white font-bold">{p.name}</h4>
                <p className="text-xs text-zinc-500 mt-1">{isConnected ? 'Connected' : 'Not Connected'}</p>
              </div>
              <Button 
                variant={isConnected ? 'secondary' : 'primary'} 
                className="w-full mt-2"
                onClick={() => toggleConnection(p.id)}
                isLoading={loading[p.id]}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export const AchievementsSection = () => {
  return (
    <Card title="Achievements Snapshot" description="Your overall progress and milestones.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Current Streak', value: '12', unit: 'days', icon: Activity, color: 'text-orange-500' },
          { label: 'Goals Completed', value: '4', unit: 'goals', icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Completion Rate', value: '92', unit: '%', icon: Star, color: 'text-amber-500' },
          { label: 'Total Badges', value: '7', unit: 'earned', icon: Shield, color: 'text-blue-500' }
        ].map((s, i) => (
          <div key={i} className="p-6 rounded-3xl bg-black/20 border border-white/5 flex flex-col items-center justify-center text-center group">
            <s.icon size={20} className={`${s.color} mb-3 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all`} />
            <span className="text-3xl font-black text-white tracking-tight mb-1">{s.value}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{s.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const DangerZoneSection = ({ addToast }: any) => {
  const [modalType, setModalType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confirmAction = async () => {
    setIsLoading(true);
    try {
      if (modalType === 'deactivate') {
        await MockApi.deactivateAccount();
        addToast('success', 'Account deactivated.');
      } else if (modalType === 'delete') {
        await MockApi.deleteAccount();
        addToast('success', 'Account deleted.');
      }
      setModalType(null);
    } catch (e) {
      addToast('error', 'Action failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-rose-500/20 bg-rose-500/[0.02]" title="Danger Zone" description="Irreversible actions regarding your account data.">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl border border-rose-500/10 bg-rose-500/5">
          <div>
            <h4 className="text-white font-bold text-sm">Export Data</h4>
            <p className="text-zinc-400 text-xs mt-0.5">Download a copy of your personal data.</p>
          </div>
          <Button variant="ghost" className="text-white mt-3 sm:mt-0"><Download size={16} /> Export JSON</Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl border border-rose-500/10 bg-rose-500/5">
          <div>
            <h4 className="text-white font-bold text-sm">Deactivate Account</h4>
            <p className="text-zinc-400 text-xs mt-0.5">Temporarily hide your profile and pause goals.</p>
          </div>
          <Button variant="secondary" className="mt-3 sm:mt-0" onClick={() => setModalType('deactivate')}>Deactivate</Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl border border-rose-500/20 bg-rose-500/10">
          <div>
            <h4 className="text-rose-400 font-bold text-sm">Delete Account</h4>
            <p className="text-rose-400/70 text-xs mt-0.5">Permanently remove your account and all data.</p>
          </div>
          <Button variant="danger" className="mt-3 sm:mt-0" onClick={() => setModalType('delete')}>Delete Account</Button>
        </div>
      </div>

      <AnimatePresence>
        {modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !isLoading && setModalType(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative bg-[#0c0c0c] border border-rose-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Are you absolutely sure?</h3>
              <p className="text-sm text-zinc-400 mb-8">
                {modalType === 'delete' 
                  ? "This action cannot be undone. This will permanently delete your account and remove your data from our servers." 
                  : "Your account will be disabled until you log in again."}
              </p>
              <div className="flex gap-3 w-full">
                <Button variant="secondary" className="flex-1" onClick={() => setModalType(null)} disabled={isLoading}>Cancel</Button>
                <Button variant="danger" className="flex-1" onClick={confirmAction} isLoading={isLoading}>Yes, {modalType}</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Card>
  );
};
