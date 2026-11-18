/* Shared annual calendar. No DOM access, timers, libraries, or network requests. */
((root, factory) => {
  'use strict';
  const calendar = factory();
  if (typeof module === 'object' && module.exports) module.exports = calendar;
  if (root) root.KTHQSeasonCalendar = calendar;
})(typeof window === 'undefined' ? null : window, () => {
  'use strict';
  const defaultTimeZone = 'America/New_York';
  const themes = Object.freeze([
    'standard', 'winter', 'valentine', 'independence',
    'fiscal', 'halloween', 'thanksgiving', 'christmas'
  ]);
  const formatters = new Map();
  const isTheme = value => typeof value === 'string' && themes.includes(value);

  function formatter(timeZone) {
    const zone = typeof timeZone === 'string' && timeZone ? timeZone : defaultTimeZone;
    if (formatters.has(zone)) return formatters.get(zone);
    let result;
    try {
      result = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
        timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric'
      });
    } catch (error) {
      if (zone !== defaultTimeZone) return formatter(defaultTimeZone);
      throw error;
    }
    formatters.set(zone, result);
    return result;
  }

  function getEasternParts(date = new Date(), timeZone = defaultTimeZone) {
    try {
      if (date === null || typeof date === 'boolean') return null;
      const instant = new Date(date);
      if (!Number.isFinite(instant.getTime())) return null;
      const parts = {};
      for (const part of formatter(timeZone).formatToParts(instant)) {
        if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
          parts[part.type] = Number(part.value);
        }
      }
      return parts.year && parts.month && parts.day ? parts : null;
    } catch (error) {
      return null;
    }
  }

  function thanksgivingDay(year) {
    if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
    const november = new Date(0);
    // setUTCFullYear avoids Date.UTC's special treatment of years 0–99.
    november.setUTCFullYear(year, 10, 1);
    return 22 + ((4 - november.getUTCDay() + 7) % 7);
  }

  function seasonForParts(parts) {
    if (!parts) return 'standard';
    switch (parts.month) {
      case 1: return 'winter';
      case 2: return 'valentine';
      case 7: return 'independence';
      case 9: return 'fiscal';
      case 10: return 'halloween';
      case 11: {
        const thanksgiving = thanksgivingDay(parts.year);
        return thanksgiving === null ? 'standard'
          : parts.day <= thanksgiving ? 'thanksgiving' : 'christmas';
      }
      case 12: return 'christmas';
      default: return 'standard';
    }
  }

  function getSeason(date = new Date(), timeZone = defaultTimeZone) {
    return seasonForParts(getEasternParts(date, timeZone));
  }

  function previewParts(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1) return null;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= monthDays[month - 1] ? { year, month, day } : null;
  }

  // URL previews affect only the visitor using them; mode is shared site configuration.
  // Precedence: valid theme preview, valid calendar-date preview, forced mode, current date.
  function resolveSeason(options = {}) {
    try {
      const settings = options && typeof options === 'object' ? options : {};
      if (isTheme(settings.preview)) return settings.preview;
      const preview = previewParts(settings.previewDate);
      if (preview) return seasonForParts(preview);
      if (isTheme(settings.mode)) return settings.mode;
      return getSeason(settings.now, settings.timeZone);
    } catch (error) {
      return 'standard';
    }
  }

  return Object.freeze({
    defaultTimeZone, themes, getEasternParts, thanksgivingDay, getSeason, resolveSeason
  });
});
