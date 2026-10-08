const de = {
  'alerts.wasLive': '⚫ {streamer} war live',
  'alerts.duration': 'Dauer',
  'alerts.game': 'Kategorie',
  'alerts.viewers': 'Zuschauer',
  'alerts.watch': 'Ansehen',
  'alerts.test': '🧪 Test-Meldung aus dem Dashboard',
  'alerts.reason.liveRole': 'Live-Rolle',
};

const en: Record<keyof typeof de, string> = {
  'alerts.wasLive': '⚫ {streamer} was live',
  'alerts.duration': 'Duration',
  'alerts.game': 'Category',
  'alerts.viewers': 'Viewers',
  'alerts.watch': 'Watch',
  'alerts.test': '🧪 Test alert from the dashboard',
  'alerts.reason.liveRole': 'Live role',
};

export const alerts = { de, en };
