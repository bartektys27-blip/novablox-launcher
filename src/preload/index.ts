import { contextBridge, ipcRenderer } from 'electron'
import type { NovaApi } from '@shared/types'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as { ok: boolean; data?: T; error?: string }
  if (!res.ok) throw new Error(res.error)
  return res.data as T
}

const api: NovaApi = {
  store: {
    get: () => call('store:get'),
    patch: p => call('store:patch', p)
  },
  auth: {
    loginOAuth: id => call('auth:loginOAuth', id),
    cancelOAuth: () => call('auth:cancelOAuth'),
    connectUsername: u => call('auth:connectUsername', u),
    loginRoblox: () => call('auth:loginRoblox'),
    cancelRobloxLogin: () => call('auth:cancelRobloxLogin'),
    removeAccount: id => call('auth:removeAccount', id),
    switchAccount: id => call('auth:switchAccount', id),
    logout: () => call('auth:logout'),
    hasSecureSession: () => call('auth:hasSecureSession')
  },
  roblox: {
    status: () => call('roblox:status'),
    launch: (id, as) => call('roblox:launch', id, as),
    multiStatus: () => call('roblox:multiStatus'),
    setMulti: e => call('roblox:setMulti', e),
    resolveInput: i => call('roblox:resolveInput', i),
    games: ids => call('roblox:games', ids),
    details: id => call('roblox:details', id),
    discoverSorts: () => call('roblox:discoverSorts'),
    search: q => call('roblox:search', q),
    profile: id => call('roblox:profile', id),
    friends: id => call('roblox:friends', id),
    userFavorites: id => call('roblox:userFavorites', id),
    servers: (id, c, o) => call('roblox:servers', id, c, o),
    joinServer: (id, sid) => call('roblox:joinServer', id, sid),
    presence: ids => call('roblox:presence', ids),
    playtimeStatus: () => call('roblox:playtimeStatus'),
    onPlaytime: cb => {
      const fn = (_: unknown, e: Parameters<typeof cb>[0]): void => cb(e)
      ipcRenderer.on('playtime:event', fn)
      return () => ipcRenderer.removeListener('playtime:event', fn)
    }
  },
  mods: {
    pickFile: s => call('mods:pickFile', s),
    removeFile: s => call('mods:removeFile', s),
    apply: () => call('mods:apply'),
    restore: () => call('mods:restore'),
    status: () => call('mods:status')
  },
  discord: {
    status: () => call('discord:status'),
    test: () => call('discord:test'),
    refresh: () => call('discord:refresh')
  },
  backup: {
    exportData: () => call('backup:export'),
    importData: () => call('backup:import')
  },
  system: {
    info: () => call('system:info'),
    checkUpdate: () => call('system:checkUpdate'),
    installUpdate: () => call('system:installUpdate'),
    onUpdateProgress: cb => {
      const fn = (_: unknown, e: Parameters<typeof cb>[0]): void => cb(e)
      ipcRenderer.on('update:progress', fn)
      return () => ipcRenderer.removeListener('update:progress', fn)
    },
    setAutoStart: (e, m) => call('system:setAutoStart', e, m),
    notify: (t, b) => call('system:notify', t, b),
    clearCache: () => call('system:clearCache'),
    openExternal: u => call('system:openExternal', u),
    pickBackground: () => call('system:pickBackground'),
    online: () => call('system:online')
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    onMaximizeChange: cb => {
      const fn = (_: unknown, v: boolean): void => cb(v)
      ipcRenderer.on('window:maximized', fn)
      return () => ipcRenderer.removeListener('window:maximized', fn)
    }
  }
}

contextBridge.exposeInMainWorld('nova', api)
