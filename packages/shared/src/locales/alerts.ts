const de = {
  'alerts.wasLive': '⚫ {streamer} war live',
  'alerts.duration': 'Dauer',
  'alerts.game': 'Kategorie',
  'alerts.viewers': 'Zuschauer',
  'alerts.watch': 'Ansehen',
  'alerts.isLive': '{streamer} ist jetzt live auf {platform}!',
  'alerts.pingButton': 'Benachrichtigungen',
  'alerts.pingOn': '🔔 Du bekommst ab jetzt Live-Meldungen ({role}).',
  'alerts.pingOff': '🔕 Live-Meldungen aus – du wirst nicht mehr gepingt.',
  'alerts.pingUnavailable': 'Das geht gerade nicht – bitte wende dich an das Team.',
  'alerts.vod': 'Aufzeichnung',
  'alerts.schedule': '📅 Streamplan von {streamer}',
  'alerts.test': '🧪 Test-Meldung aus dem Dashboard',
  'alerts.reason.liveRole': 'Live-Rolle',
};

const en: Record<keyof typeof de, string> = {
  'alerts.wasLive': '⚫ {streamer} was live',
  'alerts.duration': 'Duration',
  'alerts.game': 'Category',
  'alerts.viewers': 'Viewers',
  'alerts.watch': 'Watch',
  'alerts.isLive': '{streamer} is now live on {platform}!',
  'alerts.pingButton': 'Notifications',
  'alerts.pingOn': '🔔 You’ll get live notifications from now on ({role}).',
  'alerts.pingOff': '🔕 Live notifications off – you won’t be pinged anymore.',
  'alerts.pingUnavailable': 'That doesn’t work right now – please contact the team.',
  'alerts.vod': 'Recording',
  'alerts.schedule': '📅 Stream schedule of {streamer}',
  'alerts.test': '🧪 Test alert from the dashboard',
  'alerts.reason.liveRole': 'Live role',
};

export const alerts = { de, en };
