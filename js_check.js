import http from 'k6/http';
import { parseHTML } from 'k6/html';
import { check, sleep } from 'k6';

// === Настройки нагрузки и пороги ===
export const options = {
  vus: 5,
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% запросов быстрее 1 сек
    checks: ['rate>0.95'],              // минимум 95% проверок зелёные
  },
};

// Адрес вашего сайта
const BASE_URL = 'https://dontwantyou.github.io/111/';

export default function () {
  const res = http.get(BASE_URL);
  const doc = parseHTML(res.body);

  // Динамические наборы id и классов, которые ищет JS
  const CRITICAL_IDS = ['themeBtn', 'typed', 'particles', 'progress'];
  const CRITICAL_CLASSES = ['.cursor', '.cursor-dot', '.reveal', '.tilt', '.stat-num', '.card', '.skill'];

  const idChecks = {};
  CRITICAL_IDS.forEach((id) => {
    idChecks['8. #' + id + ' существует'] = () => doc.find('#' + id).size() === 1;
  });

  const classChecks = {};
  CRITICAL_CLASSES.forEach((c) => {
    classChecks['9. есть ' + c] = () => doc.find(c).size() >= 1;
  });

  // Проверка якорей навигации
  const navLinks = doc.find('nav a').toArray();

  check(res, {
    // 1. Наличие тегов script
    '1. На странице есть тег script': () =>
      doc.find('script').size() >= 1,

    // 2. Inline-скрипт не пустой
    '2. Inline-скрипт не пустой': (r) =>
      r.body.includes('addEventListener') && r.body.length > 1500,

    // 3. Ключевые функции объявлены
    '3a. Есть function animateCursor':  (r) => r.body.includes('function animateCursor'),
    '3b. Есть function drawParticles':  (r) => r.body.includes('function drawParticles'),
    '3c. Есть function type (машинка)': (r) => r.body.includes('function type'),

    // 4. Обработчики событий
    '4. Минимум 5 addEventListener': (r) =>
      (r.body.match(/addEventListener/g) || []).length >= 5,

    // 5. localStorage
    '5. Используется localStorage': (r) => r.body.includes('localStorage'),

    // 6. IntersectionObserver + .reveal
    '6a. Есть IntersectionObserver': (r) => r.body.includes('IntersectionObserver'),
    '6b. Есть элементы .reveal':     () => doc.find('.reveal').size() >= 1,

    // 7. requestAnimationFrame + canvas 2d
    '7a. Есть requestAnimationFrame':  (r) => r.body.includes('requestAnimationFrame'),
    '7b. Есть getContext (canvas 2d)': (r) => r.body.includes('getContext'),

    // 10. Якоря навигации
    '10. Все якоря nav a[href^="#"] рабочие': () =>
      navLinks.length > 0 && navLinks.every((a) => {
        const href = a.attr('href');
        return href && href.startsWith('#') && doc.find(href).size() === 1;
      }),
  });

  // 8. Все критичные #id из JS
  check(res, idChecks);

  // 9. Все критичные CSS-классы из JS
  check(res, classChecks);

  sleep(1); // вежливая пауза
}
