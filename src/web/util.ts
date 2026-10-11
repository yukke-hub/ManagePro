export const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];

export const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
export const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
export const mdw = (d: string) => `${md(d)}(${WEEK_JA[dow(d)]})`;

export function addDays(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** 月曜始まりの週の開始日 */
export function weekStart(d: string): string {
  const w = dow(d);
  return addDays(d, w === 0 ? -6 : 1 - w);
}

export const hm = (dt: string) => dt.slice(11, 16);
export const range = (e: { start_at: string; end_at: string }) => `${hm(e.start_at)} ~ ${hm(e.end_at)}`;

/** ユーザーのタイムゾーンでの「いま」 */
export function nowIn(tz: string) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  const date = `${g('year')}-${g('month')}-${g('day')}`;
  return { date, time: `${Number(g('hour'))}:${g('minute')}` };
}
