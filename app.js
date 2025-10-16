// --- Streak logic (defaults to 0 days) ---
(function initStreak() {
  const streakEl = document.getElementById('streak-count');
  if (!streakEl) return;

  try {
    const last = localStorage.getItem('lastReadingDate'); // ISO string like '2025-10-15'
    const today = new Date();
    let streak = Number(localStorage.getItem('streak') || 0);

    if (last) {
      const lastDate = new Date(last);
      const diffDays = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
                                   Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())) / (1000*60*60*24));
      if (diffDays === 1) {
        streak = Math.max(1, streak + 1);
      } else if (diffDays > 1) {
        streak = 0; // broken streak
      } // diffDays === 0 → leave streak as-is
    } else {
      streak = 0;
    }

    localStorage.setItem('streak', String(streak));

    // Display string exactly as requested
    streakEl.textContent = `Current streak is ${streak} days`;
  } catch (e) {
    // Fallback display if storage is blocked
    streakEl.textContent = 'Current streak is 0 days';
  }
})();

// If someone wants to “log reading” elsewhere, you can set lastReadingDate
// on that page. For demo purposes, allow a long-press on the fire emoji to set today.
(function demoQuickLog() {
  const emoji = document.querySelector('.emoji');
  if (!emoji) return;
  let pressTimer;
  emoji.addEventListener('mousedown', () => {
    pressTimer = setTimeout(() => {
      localStorage.setItem('lastReadingDate', new Date().toISOString());
      alert('Logged reading for today! Your streak will update next visit.');
    }, 700);
  });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt =>
    emoji.addEventListener(evt, () => clearTimeout(pressTimer))
  );
})();

// --- Suggestion data ---
const HOBBIES = [
  { hobby: 'Gardening', title: 'The Well-Tended Perennial Garden', author: 'Tracy DiSabato-Aust' },
  { hobby: 'Cooking', title: 'Salt, Fat, Acid, Heat', author: 'Samin Nosrat' },
  { hobby: 'Hiking', title: 'A Walk in the Woods', author: 'Bill Bryson' },
  { hobby: 'Photography', title: 'Understanding Exposure', author: 'Bryan Peterson' },
  { hobby: 'Chess', title: 'Bobby Fischer Teaches Chess', author: 'B. Fischer' },
  { hobby: 'Drawing', title: 'Drawing on the Right Side of the Brain', author: 'Betty Edwards' },
  { hobby: 'Travel', title: 'Vagabonding', author: 'Rolf Potts' },
  { hobby: 'Music', title: 'This Is Your Brain on Music', author: 'Daniel Levitin' },
];

const GENRES = [
  { genre: 'Sci‑Fi', title: 'The Three-Body Problem', author: 'Cixin Liu' },
  { genre: 'Fantasy', title: 'The Name of the Wind', author: 'Patrick Rothfuss' },
  { genre: 'Mystery', title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson' },
  { genre: 'Nonfiction', title: 'Atomic Habits', author: 'James Clear' },
  { genre: 'Historical', title: 'All the Light We Cannot See', author: 'Anthony Doerr' },
  { genre: 'Romance', title: 'The Kiss Quotient', author: 'Helen Hoang' },
  { genre: 'Horror', title: 'Mexican Gothic', author: 'Silvia Moreno-Garcia' },
];

const POPULAR = [
  { title: 'Fourth Wing', author: 'Rebecca Yarros' },
  { title: 'Lessons in Chemistry', author: 'Bonnie Garmus' },
  { title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin' },
  { title: 'Project Hail Mary', author: 'Andy Weir' },
  { title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid' },
  { title: 'The Silent Patient', author: 'Alex Michaelides' },
];

// --- Helpers ---
function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function makeCard({ title, author, metaKey, metaVal }) {
  const li = document.createElement('li');
  li.className = 'card';
  const t = document.createElement('div');
  t.className = 'title';
  t.textContent = title;
  const m = document.createElement('div');
  m.className = 'meta';
  m.textContent = metaKey && metaVal ? `${metaKey}: ${metaVal}` : author ? `by ${author}` : '';
  li.appendChild(t);
  li.appendChild(m);
  return li;
}

function renderSuggestions() {
  const hobbyList = document.getElementById('hobby-list');
  const genreList = document.getElementById('genre-list');
  const popularList = document.getElementById('popular-list');
  if (!hobbyList || !genreList || !popularList) return;

  pickRandom(HOBBIES, 4).forEach(item =>
    hobbyList.appendChild(makeCard({ title: item.title, author: item.author, metaKey: 'Hobby', metaVal: item.hobby }))
  );

  pickRandom(GENRES, 4).forEach(item =>
    genreList.appendChild(makeCard({ title: item.title, author: item.author, metaKey: 'Genre', metaVal: item.genre }))
  );

  pickRandom(POPULAR, 4).forEach(item =>
    popularList.appendChild(makeCard({ title: item.title, author: item.author }))
  );
}

document.addEventListener('DOMContentLoaded', renderSuggestions);