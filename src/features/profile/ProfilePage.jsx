import React, { useEffect, useState } from 'react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Moon,
  Save,
  Settings,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { downloadSnapshot, restoreLocalSnapshot, uploadSnapshot } from '../../lib/syncSnapshot';
import { calculateCareStreak, countNightRecoveries, localDateKey } from '../../lib/careHistory';
import { Sticker } from '../../components/common/Sticker';

import logoCat from '../../../assets/stickers/cat-companion/illustrations_clean/02_sailor_flag_cat.png';
import umbrellaCat from '../../../assets/stickers/cat-companion/illustrations_clean/09_kimono_umbrella_cat.png';
import cheerRabbit from '../../../assets/stickers/cute-energy/illustrations_clean/10_cheer_rabbit.png';
import goodnightSheep from '../../../assets/stickers/cute-energy/illustrations_clean/07_goodnight_sheep.png';
import okBear from '../../../assets/stickers/cute-energy/illustrations_clean/22_ok_bear.png';
import workingRabbit from '../../../assets/stickers/cute-energy/illustrations_clean/19_working_rabbit.png';
import loveBear from '../../../assets/stickers/cute-energy/illustrations_clean/01_love_bear.png';

function SettingOption({ active, children, onClick }) {
  return (
    <button className={active ? 'is-active' : ''} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function ProfileSheetActions({ onCancel, onSave, saveLabel = '保存设置' }) {
  return (
    <div className="profile-sheet-actions">
      <button className="secondary" onClick={onCancel} type="button">取消</button>
      <button className="profile-sheet-primary" onClick={onSave} type="button">{saveLabel}</button>
    </div>
  );
}

const reminderOptions = ['下班后', '睡醒后', '睡前', '休息日中午', '关闭提醒'];
const trainingPlaceOptions = ['健身房', '家里', '速食便利店'];
const trainingDurationOptions = ['15分钟', '30分钟', '45分钟', '60分钟'];
const foodPreferenceOptions = ['正常吃饭', '夜班后小份恢复', '便利店优先', '少油少刺激'];

export function ProfilePage() {
  const [protectMode, setProtectMode] = useLocalStorageState('profile-protect-mode', true);
  const [nightMode, setNightMode] = useLocalStorageState('profile-night-mode', true);
  const [reminderTime, setReminderTime] = useLocalStorageState('profile-reminder-time', '下班后');
  const [trainingPreference, setTrainingPreference] = useLocalStorageState('profile-training-preference', {
    place: '健身房',
    duration: '30分钟',
  });
  const [foodPreference, setFoodPreference] = useLocalStorageState('profile-food-preference', '正常吃饭');
  const [careHistory] = useLocalStorageState('care-history', []);
  const [stickerFavorites] = useLocalStorageState('sticker-favorites', ['慢慢来']);
  const [activeSheet, setActiveSheet] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(null);
  const [reminderDraft, setReminderDraft] = useState(reminderTime);
  const [trainingDraft, setTrainingDraft] = useState(trainingPreference);
  const [foodDraft, setFoodDraft] = useState(foodPreference);
  const [profile, setProfile] = useLocalStorageState('profile', {
    name: '今天也慢慢来',
    goal: '夜班后恢复 + 轻塑形',
    avatar: logoCat,
    avatarType: 'preset',
  });
  const [session, setSession] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState('登录后可以把计划、记录和个人设置同步到云端。');
  const [cloudSnapshot, setCloudSnapshot] = useState(null);
  const careStreak = calculateCareStreak(careHistory);
  const nightRecoveryCount = countNightRecoveries(careHistory);
  const favoriteCount = Array.isArray(stickerFavorites) ? stickerFavorites.length : 0;
  const avatarOptions = [
    { label: '元气', src: logoCat },
    { label: '慢慢来', src: umbrellaCat },
    { label: '加油', src: cheerRabbit },
    { label: '恢复', src: goodnightSheep },
    { label: '喜欢', src: loveBear },
    { label: 'OK', src: okBear },
  ];
  const settings = [
    { id: 'reminder', title: '提醒时间', value: reminderTime, icon: CalendarDays },
    { id: 'food', title: '饮食偏好', value: foodPreference, icon: Utensils },
    {
      id: 'training',
      title: '训练偏好',
      value: `${trainingPreference.place} · ${trainingPreference.duration}`,
      icon: Dumbbell,
    },
    { id: 'sync', title: '数据备份', value: session ? '已登录' : '登录同步', icon: Save },
  ];

  useEffect(() => {
    if (!supabase) {
      setSyncStatus('还没有配置 Supabase，同步功能暂时不可用。');
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    const refreshSession = async () => {
      const { data: current } = await supabase.auth.getSession();
      setSession(current.session || null);
    };
    window.addEventListener('focus', refreshSession);
    document.addEventListener('visibilitychange', refreshSession);

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('focus', refreshSession);
      document.removeEventListener('visibilitychange', refreshSession);
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    let cancelled = false;

    async function prepareCloudSnapshot() {
      setSyncBusy(true);
      try {
        const snapshot = await downloadSnapshot(userId);
        if (cancelled) return;

        if (!snapshot) {
          await uploadSnapshot(userId);
          if (!cancelled) {
            setCloudSnapshot(null);
            setSyncStatus('首次登录，已把这台设备的数据备份到云端。');
          }
          return;
        }

        setCloudSnapshot(snapshot);
        setSyncStatus('已找到云端数据。可以恢复云端，也可以用本机数据覆盖云端。');
      } catch (error) {
        if (!cancelled) setSyncStatus(`同步检查失败：${error.message}`);
      } finally {
        if (!cancelled) setSyncBusy(false);
      }
    }

    prepareCloudSnapshot();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function signInWithPassword() {
    if (!supabase) {
      setSyncStatus('Supabase 还没有配置好。');
      return;
    }

    const email = loginEmail.trim();
    if (!email || !email.includes('@')) {
      setSyncStatus('请输入正确的登录邮箱。');
      return;
    }
    if (loginPassword.length < 6) {
      setSyncStatus('密码至少需要6位。');
      return;
    }

    setSyncBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error) throw error;
      setSession(data.session || null);
      setLoginPassword('');
      setSyncStatus('登录成功，正在检查云端数据。');
    } catch (error) {
      setSyncStatus(error.message === 'Invalid login credentials'
        ? '邮箱或密码不正确，请重新输入。'
        : `登录失败：${error.message}`);
    } finally {
      setSyncBusy(false);
    }
  }

  async function saveLocalToCloud() {
    const userId = session?.user?.id;
    if (!userId) return;

    setSyncBusy(true);
    try {
      await uploadSnapshot(userId);
      const snapshot = await downloadSnapshot(userId);
      setCloudSnapshot(snapshot);
      setSyncStatus('已把本机数据同步到云端。');
    } catch (error) {
      setSyncStatus(`上传失败：${error.message}`);
    } finally {
      setSyncBusy(false);
    }
  }

  function useCloudSnapshot() {
    if (!cloudSnapshot?.data) {
      setSyncStatus('还没有可恢复的云端数据。');
      return;
    }

    restoreLocalSnapshot(cloudSnapshot.data);
    setSyncStatus('已恢复云端数据，页面马上刷新。');
    window.setTimeout(() => window.location.reload(), 450);
  }

  async function signOut() {
    if (!supabase) return;
    setSyncBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setCloudSnapshot(null);
      setSyncStatus('已退出登录。本机数据还会保留在这台设备上。');
    } catch (error) {
      setSyncStatus(`退出失败：${error.message}`);
    } finally {
      setSyncBusy(false);
    }
  }

  function openProfileEdit() {
    setProfileDraft({ ...profile });
    setEditingProfile(true);
  }

  function closeProfileEdit() {
    setEditingProfile(false);
    setProfileDraft(null);
  }

  function saveProfileEdit() {
    if (profileDraft) setProfile(profileDraft);
    closeProfileEdit();
  }

  function openSettingSheet(id) {
    if (id === 'reminder') setReminderDraft(reminderTime);
    if (id === 'training') setTrainingDraft({ ...trainingPreference });
    if (id === 'food') setFoodDraft(foodPreference);
    setActiveSheet(id);
  }

  function closeSettingSheet() {
    setActiveSheet(null);
  }

  function saveReminder() {
    setReminderTime(reminderDraft);
    closeSettingSheet();
  }

  function saveTraining() {
    setTrainingPreference(trainingDraft);
    closeSettingSheet();
  }

  function saveFood() {
    setFoodPreference(foodDraft);
    closeSettingSheet();
  }

  const draftProfile = profileDraft || profile;

  return (
    <section className="sub-page profile-page">
      <article className="profile-hero-card">
        <button className="profile-main profile-edit-trigger" onClick={openProfileEdit} type="button">
          <Sticker src={profile.avatar} alt="头像贴纸" className="profile-avatar" />
          <div>
            <h1>{profile.name}</h1>
            <p>目标：{profile.goal}</p>
          </div>
          <span>编辑</span>
        </button>
        <button className={protectMode ? 'protect-pill is-on' : 'protect-pill'} onClick={() => setProtectMode(!protectMode)} type="button">
          {protectMode ? '小白保护已开启' : '开启小白保护'}
        </button>
      </article>

      <article className={`sync-panel sync-panel-live ${session ? 'is-authenticated' : 'is-logged-out'}`}>
        <div>
          <h2>远程登录与同步</h2>
          <p>{syncStatus}</p>
          {session?.user?.email && <span className="sync-account">{session.user.email}</span>}
        </div>
        {session ? (
          <div className="sync-actions">
            <button disabled={syncBusy} onClick={saveLocalToCloud} type="button">同步本机</button>
            <button disabled={syncBusy || !cloudSnapshot} onClick={useCloudSnapshot} type="button">恢复云端</button>
            <button disabled={syncBusy} onClick={signOut} type="button">退出</button>
          </div>
        ) : (
          <div className="sync-login-password">
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="登录邮箱"
              type="email"
              value={loginEmail}
            />
            <input
              autoComplete="current-password"
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="登录密码"
              type="password"
              value={loginPassword}
            />
            <button disabled={syncBusy} onClick={signInWithPassword} type="button">
              {syncBusy ? '登录中' : '登录并同步'}
            </button>
          </div>
        )}
      </article>

      <section className="profile-stats">
        <article>
          <strong>{careStreak}天</strong>
          <span>连续照顾自己</span>
        </article>
        <article>
          <strong>{nightRecoveryCount}次</strong>
          <span>夜班后恢复</span>
        </article>
        <article>
          <strong>{favoriteCount}张</strong>
          <span>收藏贴纸</span>
        </article>
      </section>

      <section className="profile-switches">
        <button className={nightMode ? 'switch-row is-on' : 'switch-row'} onClick={() => setNightMode(!nightMode)} type="button">
          <span>
            <Moon size={18} />
            夜班模式
          </span>
          <em>{nightMode ? '开' : '关'}</em>
        </button>
        <button className={protectMode ? 'switch-row is-on' : 'switch-row'} onClick={() => setProtectMode(!protectMode)} type="button">
          <span>
            <ShieldCheck size={18} />
            小白保护模式
          </span>
          <em>{protectMode ? '开' : '关'}</em>
        </button>
      </section>

      <div className="settings-list profile-settings">
        {settings.map(({ id, title, value, icon: Icon }) => (
          <button key={id} onClick={() => openSettingSheet(id)} type="button">
            <span className="setting-icon">
              <Icon size={17} />
            </span>
            <span className="setting-copy">
              <strong>{title}</strong>
              <small>{value}</small>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>

      <article className="profile-note-card">
        <div>
          <h2>今天也不用着急</h2>
          <p>你不用一下子做到完美。先吃好一点、动一点、早点休息，就已经是在认真照顾自己啦。</p>
        </div>
        <Sticker src={umbrellaCat} alt="慢慢来猫贴纸" />
      </article>

      {activeSheet === 'reminder' && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeSettingSheet}>
          <section className="profile-setting-sheet" role="dialog" aria-modal="true" aria-label="提醒时间设置" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>提醒时间</h2>
            <p>选一个你最容易打开 App 的时间就好。</p>
            <div className="setting-options">
              {reminderOptions.map((item) => (
                <SettingOption active={reminderDraft === item} key={item} onClick={() => setReminderDraft(item)}>
                  {item}
                </SettingOption>
              ))}
            </div>
            <ProfileSheetActions onCancel={closeSettingSheet} onSave={saveReminder} />
          </section>
        </div>
      )}

      {activeSheet === 'training' && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeSettingSheet}>
          <section className="profile-setting-sheet" role="dialog" aria-modal="true" aria-label="训练偏好设置" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>训练偏好</h2>
            <p>默认值只是帮你少点几下，随时可以改。</p>
            <h3 className="setting-group-title">默认训练地点</h3>
            <div className="setting-options">
              {trainingPlaceOptions.map((item) => (
                <SettingOption
                  active={trainingDraft.place === item}
                  key={item}
                  onClick={() => setTrainingDraft((current) => ({ ...current, place: item }))}
                >
                  {item}
                </SettingOption>
              ))}
            </div>
            <h3 className="setting-group-title">默认训练时长</h3>
            <div className="setting-option-grid">
              {trainingDurationOptions.map((item) => (
                <SettingOption
                  active={trainingDraft.duration === item}
                  key={item}
                  onClick={() => setTrainingDraft((current) => ({ ...current, duration: item }))}
                >
                  {item}
                </SettingOption>
              ))}
            </div>
            <ProfileSheetActions onCancel={closeSettingSheet} onSave={saveTraining} />
          </section>
        </div>
      )}

      {activeSheet === 'food' && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeSettingSheet}>
          <section className="profile-setting-sheet" role="dialog" aria-modal="true" aria-label="饮食偏好设置" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>饮食偏好</h2>
            <p>不是限制你吃什么，只是让建议更贴近你。</p>
            <div className="setting-options">
              {foodPreferenceOptions.map((item) => (
                <SettingOption active={foodDraft === item} key={item} onClick={() => setFoodDraft(item)}>
                  {item}
                </SettingOption>
              ))}
            </div>
            <ProfileSheetActions onCancel={closeSettingSheet} onSave={saveFood} />
          </section>
        </div>
      )}

      {activeSheet === 'sync' && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeSettingSheet}>
          <section className="profile-setting-sheet" role="dialog" aria-modal="true" aria-label="数据备份" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>数据备份</h2>
            <p>这个功能后续会接上。现在计划和记录会先保存在你的手机里，刷新也不会丢。</p>
            <button className="profile-sheet-primary" onClick={closeSettingSheet} type="button">知道了</button>
          </section>
        </div>
      )}

      {editingProfile && profileDraft && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeProfileEdit}>
          <section className="profile-edit-sheet" role="dialog" aria-modal="true" aria-label="编辑个人资料" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>编辑个人资料</h2>
            <p>头像和昵称都可以自己来，参与感会更强一点。</p>

            <div className="profile-edit-preview">
              <Sticker src={draftProfile.avatar} alt="当前头像" className="profile-avatar large" />
              <div>
                <strong>{draftProfile.name}</strong>
                <span>{draftProfile.goal}</span>
              </div>
            </div>

            <label className="profile-field">
              <span>昵称</span>
              <input
                value={draftProfile.name}
                onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label className="profile-field">
              <span>当前目标</span>
              <textarea
                rows={2}
                value={draftProfile.goal}
                onChange={(event) => setProfileDraft((current) => ({ ...current, goal: event.target.value }))}
              />
            </label>

            <section className="avatar-picker">
              <h3>选择内置贴纸头像</h3>
              <div>
                {avatarOptions.map((item) => (
                  <button
                    className={draftProfile.avatar === item.src ? 'is-active' : ''}
                    key={item.label}
                    onClick={() => setProfileDraft((current) => ({ ...current, avatar: item.src, avatarType: 'preset' }))}
                    type="button"
                  >
                    <Sticker src={item.src} alt={`${item.label}头像`} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <label className="upload-avatar">
              <input
                accept="image/*"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setProfileDraft((current) => ({ ...current, avatar: reader.result, avatarType: 'upload' }));
                  };
                  reader.readAsDataURL(file);
                }}
              />
              上传自己的图片
            </label>

            <ProfileSheetActions onCancel={closeProfileEdit} onSave={saveProfileEdit} saveLabel="保存我的资料" />
          </section>
        </div>
      )}
    </section>
  );
}
