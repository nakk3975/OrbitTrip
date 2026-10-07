// UTC is a neutral calendar axis here, not a conversion between airport timezones.
export const dayNumber = date => Date.parse(date + 'T00:00:00Z') / 60000;
const stamp = minutes => new Date(minutes * 60000).toISOString().slice(0, 16);
export const dateTime = (date, minutes) => stamp(dayNumber(date) + minutes);
const rawMinute = time => {const [h, m] = time.split(':').map(Number); return h * 60 + m;};
const labels = {
 arrival: '도착 / 입국·수하물', checkin: '체크인', checkout: '체크아웃',
 departure: '출국 수속 / 탑승', transfer: '공항·숙소 이동', wait: '체크인 대기'
};

export function overnightContext(config, date, base, {minute, clock, travel, station, sameDayLogistics}) {
 const first = dayNumber(config.start), last = dayNumber(config.end), day = dayNumber(date);
 const stays = config.stays || [], arrival = config.flights?.arrival, departure = config.flights?.departure;
 const segments = [];
 const add = (place, kind, begin, finish, endpoint = place) => segments.push({
  ...place, kind, begin, finish, endpoint, name: place.name + ' · ' + labels[kind],
  locked: true, buffer: 0, type: '여행 준비',
  stayId: ['checkin', 'checkout'].includes(kind) ? place.id : undefined,
  ...(kind === 'transfer' ? {transferFrom: place, transferTo: endpoint, transferMinutes: finish - begin} : {})
 });
 let arrivalEnd = null, departureStart = null;

 if (arrival) {
  const hotel = stays.find(s => s.from === config.start);
  const at = first + minute(arrival.time), ready = at + Number(arrival.buffer);
  const move = hotel ? travel(arrival, hotel, config.travelMode) : 0;
  const check = hotel ? Math.max(first + minute(hotel.checkin), ready + move) : ready;
  const end = check + (hotel ? Number(hotel.checkinDuration) : 0);
  if (end >= first + 1440) {
   add(arrival, 'arrival', at, ready);
   if (hotel) {
    if (move) add(arrival, 'transfer', ready, ready + move, hotel);
    if (check > ready + move) add(hotel, 'wait', ready + move, check);
    add(hotel, 'checkin', check, end);
   }
   arrivalEnd = end;
  }
 }

 // Check-in may also cross midnight on a hotel change day without a late flight.
 for (const hotel of stays) {
  if (arrival && hotel.from === config.start || hotel.from < config.start || hotel.from > config.end) continue;
  const original = sameDayLogistics(config, hotel.from).anchors.find(p => p.kind === 'checkin');
  if (!original) continue;
  const at = dayNumber(hotel.from) + rawMinute(original.start);
  const end = dayNumber(hotel.from) + rawMinute(original.end);
  if (end >= dayNumber(hotel.from) + 1440) add({...hotel, hotelOnly: true}, 'checkin', at, end, hotel);
 }

 if (departure) {
  const hotel = stays.find(s => s.from < config.end && config.end <= s.to);
  const at = last + minute(departure.time), ready = at - Number(departure.buffer);
  const origin = hotel || station(config.cities.at(-1));
  const move = travel(origin, departure, config.travelMode);
  const duration = hotel?.to === config.end ? Number(hotel.checkoutDuration) : 0;
  const start = ready - move - duration;
  if (start < last) {
   departureStart = start;
   if (duration) add(hotel, 'checkout', start, start + duration);
   if (move) add(origin, 'transfer', start + duration, ready, departure);
   add(departure, 'departure', ready, at);
  }
 }
 if (!segments.length) return base;

 // Validation reports overflow; form rendering must still allow the user to fix the dates.
 const timelineOverflow = segments.some(p => p.begin < first || p.finish > last + 1440);
 const hotelSegments = segments.filter(p => p.kind === 'checkin' && p.hotelOnly && p.begin < day + 1440 && p.finish >= day);
 const hotelCrossing = hotelSegments.length > 0;
 const incoming = arrivalEnd !== null && day <= arrivalEnd && day + 1440 > first;
 const outgoing = departureStart !== null && day + 1440 > departureStart && day <= last;
 if (!incoming && !outgoing && !hotelCrossing) return {...base, timelineOverflow};

 const anchors = base.anchors.filter(p =>
  !((incoming || hotelCrossing) && ['arrival', 'checkin'].includes(p.kind)) &&
  !(outgoing && ['checkout', 'departure'].includes(p.kind))
 );
 // Half-open intervals ensure a midnight endpoint is never duplicated as a zero-length item.
 const local = segments.filter(p => p.begin < day + 1440 && p.finish > day).map((p, i) => {
  const start = Math.max(p.begin, day), end = Math.min(p.finish, day + 1440);
  return {
   ...p, id: p.kind + '-' + date + '-' + i, uid: p.kind + '-' + date + '-' + i,
   start: clock(start - day), end: clock(end - day),
   startDateTime: stamp(start), endDateTime: stamp(end),
   // A transfer does not advance the day-end position until it actually finishes.
   endpoint: p.finish <= day + 1440 ? p.endpoint : p,
   logisticsContinuation: true,
   note: '공항 현지 날짜 기준 · ' + stamp(p.begin).replace('T', ' ') + ' → ' + stamp(p.finish).replace('T', ' ')
  };
 });
 const window = {...base.window};
 let origin = base.origin, destination = base.destination;
 if (incoming) {
  window.start = day === first ? arrival.time : '00:00';
  window.end = clock(Math.min(1440, Math.max(minute(window.end), arrivalEnd - day)));
  origin = local[0] || stays.find(s => s.from === config.start) || arrival;
  destination = arrivalEnd >= day + 1440 ? null : base.destination;
 }
 if (hotelCrossing) {
  window.start = clock(Math.min(minute(window.start), Math.max(0, local[0]?.begin - day || 0)));
  window.end = clock(Math.min(1440, Math.max(minute(window.end), ...hotelSegments.map(p => p.finish - day))));
  if (local[0]?.begin < day) origin = local[0];
  if (hotelSegments.some(p => p.finish >= day + 1440)) destination = null;
 }
 if (outgoing) {
  window.end = clock(Math.min(1440, last + minute(departure.time) - day));
  window.start = day === last ? '00:00' : clock(Math.min(minute(window.start), departureStart - day));
  destination = null;
  if (!incoming && day === last) origin = local[0] || departure;
  else if (!incoming && local[0]?.begin < day) origin = local[0];
 }
 const closed = outgoing && day === last && minute(departure.time) === 0;
 if (closed) origin = departure;
 const earliestTourism = incoming || hotelCrossing && local[0]?.begin < day
  ? minute(config.windows?.[date]?.start || '09:00') : null;
 return {...base, origin, destination, window, anchors: [...anchors, ...local],
  arrival: incoming || base.arrival, closed, timelineOverflow, earliestTourism};
}
