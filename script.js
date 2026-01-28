// Simple Luhn (Mod10) implementation with formatting, masking, toggle eye, and card icons.

const cardInput = document.getElementById('card-number');
const cardTypeEl = document.getElementById('card-type');
const cardIconEl = document.getElementById('card-icon');
const helper = document.getElementById('helper');
const form = document.getElementById('card-form');
const result = document.getElementById('result');
const submitBtn = document.getElementById('submit-btn');

const generateBtn = document.getElementById('generate-btn');
const generateLength = document.getElementById('generate-length');
const generatePrefix = document.getElementById('generate-prefix');

const toggleMaskBtn = document.getElementById('toggle-mask');

const luhnCalcEl = document.getElementById('luhn-calc');

const cardPatterns = [
  { type: 'Visa', regex: /^4/ },
  { type: 'Mastercard', regex: /^(5[1-5]|2[2-7])/ },
  { type: 'American Express', regex: /^3[47]/ },
  { type: 'Discover', regex: /^(6011|65|64[4-9])/ },
];

let rawDigits = '';        // canonical digits only
let maskEnabled = true;    // default: mask all but last 4
let editing = false;       // true while user actively focused (temporary unmask for editing)

// ----------------- Utilities -----------------
function digitsOnly(value) {
  return (value || '').toString().replace(/\D+/g, '');
}

function formatCardNumber(value) {
  const d = digitsOnly(value);
  if (/^3[47]/.test(d)) {
    const parts = [];
    if (d.length > 0) parts.push(d.substring(0, Math.min(4, d.length)));
    if (d.length > 4) parts.push(d.substring(4, Math.min(10, d.length)));
    if (d.length > 10) parts.push(d.substring(10, 15));
    return parts.join(' ');
  }
  return d.replace(/(.{4})/g, '$1 ').trim();
}

// simpler grouping for masked strings (works with mask chars)
function groupEvery4(s) {
  return s.replace(/(.{4})/g, '$1 ').trim();
}

// Luhn boolean check
function luhnCheck(number) {
  const digits = digitsOnly(number);
  if (digits.length === 0) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      d = d * 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// Luhn details for explanation
function luhnDetails(number) {
  const digits = digitsOnly(number);
  if (digits.length === 0) return null;
  const arr = digits.split('').map(ch => parseInt(ch, 10));
  const details = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const posFromRight = arr.length - 1 - i;
    const original = arr[i];
    const shouldDouble = posFromRight % 2 === 1;
    let doubledValue = null;
    let transformed = original;
    if (shouldDouble) {
      doubledValue = original * 2;
      transformed = doubledValue > 9 ? doubledValue - 9 : doubledValue;
    }
    details.push({ index: i, original, shouldDouble, doubledValue, transformed, posFromRight });
  }
  const sum = details.reduce((s, it) => s + it.transformed, 0);
  const valid = sum % 10 === 0;
  return { digits, details, sum, valid };
}

// ----------------- Card icons -----------------
function getCardSvg(type) {
  // Minimal SVGs, monochrome. Returns an SVG string.
  switch (type) {
    case 'Visa':
      return `<svg width="36" height="24" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect rx="4" width="36" height="24" fill="#1a73e8"/>
        <text x="50%" y="60%" fill="#fff" font-size="10" font-family="sans-serif" font-weight="700" text-anchor="middle">VISA</text>
      </svg>`;
    case 'Mastercard':
      return `<svg width="36" height="24" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect rx="4" width="36" height="24" fill="#fff" stroke="#e6e7ea"/>
        <g transform="translate(3,2)">
          <circle cx="10" cy="10" r="7" fill="#ff5f00"/>
          <circle cx="18" cy="10" r="7" fill="#eb001b" style="mix-blend-mode:screen"/>
        </g>
      </svg>`;
    case 'American Express':
      return `<svg width="36" height="24" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect rx="4" width="36" height="24" fill="#2e77bb"/>
        <text x="50%" y="60%" fill="#fff" font-size="8" font-family="sans-serif" font-weight="700" text-anchor="middle">AMEX</text>
      </svg>`;
    case 'Discover':
      return `<svg width="36" height="24" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect rx="4" width="36" height="24" fill="#fff" stroke="#f2f2f2"/>
        <text x="50%" y="60%" fill="#f57c00" font-size="8" font-family="sans-serif" font-weight="700" text-anchor="middle">DISC</text>
      </svg>`;
    default:
      return `<svg width="36" height="24" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect rx="4" width="36" height="24" fill="#f3f4f6"/>
        <text x="50%" y="60%" fill="#6b7280" font-size="8" font-family="sans-serif" font-weight="700" text-anchor="middle">CARD</text>
      </svg>`;
  }
}

function updateCardIcon(type) {
  cardIconEl.innerHTML = getCardSvg(type);
}

// ----------------- Masking display -----------------
function maskedDisplay(digits) {
  // show mask for all but last 4 digits; if <=4 show digits
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  const visible = digits.slice(-4);
  const maskedPart = digits.slice(0, -4).replace(/\d/g, '•');
  // group into fours for readability
  return groupEvery4(maskedPart + visible);
}

function getDisplayedValue() {
  if (maskEnabled && !editing) {
    return maskedDisplay(rawDigits);
  } else {
    return formatCardNumber(rawDigits);
  }
}

// ----------------- Luhn render -----------------
function renderLuhnDetails(number) {
  const info = luhnDetails(number);
  if (!info) {
    luhnCalcEl.innerHTML = '<p class="muted">Enter a card number to see a step-by-step Luhn calculation here.</p>';
    return;
  }

  const leftToRight = [...info.details].reverse();

  const digitBoxes = leftToRight.map((d) => {
    const cls = 'luhn-digit' + (d.shouldDouble ? ' doubled' : '');
    if (d.shouldDouble) {
      const dbl = d.doubledValue;
      const transformed = d.transformed;
      return `<div class="${cls}" title="Original ${d.original}: doubled=${dbl} → ${transformed}"><div>${d.original}</div></div>`;
    } else {
      return `<div class="${cls}" title="Original ${d.original}: not doubled"><div>${d.original}</div></div>`;
    }
  }).join('');

  const exprParts = leftToRight.map((d) => {
    if (d.shouldDouble) {
      const dbl = d.doubledValue;
      if (dbl > 9) {
        return `(${d.original}×2=${dbl} → ${d.transformed})`;
      }
      return `(${d.original}×2=${dbl})`;
    } else {
      return `${d.original}`;
    }
  });

  const expr = exprParts.join(' + ');
  const validityText = info.valid ? 'passes (sum % 10 = 0)' : 'fails (sum % 10 ≠ 0)';

  luhnCalcEl.innerHTML = `
    <div class="luhn-row" aria-hidden="true">${digitBoxes}</div>
    <div class="luhn-exp"><strong>Expression:</strong> ${expr} = <strong>${info.sum}</strong></div>
    <div class="luhn-note"><strong>Result:</strong> ${info.sum} % 10 = ${info.sum % 10} — ${validityText}</div>
  `;
}

// ----------------- State updates -----------------
function setRawDigits(newDigits) {
  rawDigits = digitsOnly(newDigits);
  // update card icon and type
  const type = detectCardType(rawDigits);
  cardTypeEl.textContent = type;
  updateCardIcon(type);

  // update masks / display
  cardInput.value = getDisplayedValue();
  // update luhn details
  renderLuhnDetails(rawDigits);

  // validation for enabling button
  if (rawDigits.length >= 12 && luhnCheck(rawDigits)) {
    showValidity(true);
  } else {
    // if length >=12 but invalid show invalid; else neutral
    if (rawDigits.length >= 12) showValidity(luhnCheck(rawDigits));
    else showNeutral();
  }
  // ensure caret at end for edits
  try { cardInput.setSelectionRange(cardInput.value.length, cardInput.value.length); } catch (e) {}
}

// Detect card type
function detectCardType(number) {
  const d = digitsOnly(number);
  for (const p of cardPatterns) {
    if (p.regex.test(d)) return p.type;
  }
  return 'Unknown';
}

// ----------------- UI feedback -----------------
function showValidity(isValid) {
  result.className = 'result ' + (isValid ? 'good' : 'bad');
  result.textContent = isValid ? 'Luhn check passed (Mod10).' : 'Luhn check failed.';
  submitBtn.disabled = !isValid;
  helper.textContent = isValid ? 'Looks good.' : 'Invalid card number (failed Mod10).';
}
function showNeutral() {
  result.className = 'result';
  result.textContent = '';
  submitBtn.disabled = true;
  helper.textContent = 'Enter your card number — spaces allowed.';
}

// ----------------- Input handling -----------------
// When user types, we want to update rawDigits. For convenience:
// - When masked and not editing, typing shouldn't occur (we auto-unmask on focus).
// - On input event we parse digits and update.
cardInput.addEventListener('input', (e) => {
  // read the typed value and extract digits
  const typed = e.target.value;
  const digits = digitsOnly(typed);
  // update canonical digits and re-render
  setRawDigits(digits);
});

// focus: if mask enabled and not currently editing, temporarily unmask so user can edit
cardInput.addEventListener('focus', () => {
  if (maskEnabled) {
    editing = true;
    // show unmasked formatted value for editing
    cardInput.value = formatCardNumber(rawDigits);
    // move caret to end
    try { cardInput.setSelectionRange(cardInput.value.length, cardInput.value.length); } catch (e) {}
  }
});

// blur: if mask enabled, revert to masked display
cardInput.addEventListener('blur', () => {
  if (maskEnabled) {
    editing = false;
    cardInput.value = getDisplayedValue();
  }
});

// toggle eye button
toggleMaskBtn.addEventListener('click', () => {
  maskEnabled = !maskEnabled;
  // toggle visual state
  if (maskEnabled) {
    toggleMaskBtn.setAttribute('aria-label', 'Show card number');
    toggleMaskBtn.classList.remove('active');
  } else {
    toggleMaskBtn.setAttribute('aria-label', 'Hide card number');
    toggleMaskBtn.classList.add('active');
  }
  // re-render input display
  cardInput.value = getDisplayedValue();
  // update luhn details and helper
  renderLuhnDetails(rawDigits);
});

// ----------------- Luhn & generate logic (unchanged, extended) -----------------
function luhnSum(number) {
  const digits = digitsOnly(number);
  if (digits.length === 0) return 0;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      d = d * 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum;
}

function computeLuhnCheckDigit(partial) {
  const sumWithZero = luhnSum(partial + '0');
  const check = (10 - (sumWithZero % 10)) % 10;
  return String(check);
}

// Generate number respecting prefix and lengths 1..19
function generateLuhn(length, prefix) {
  length = parseInt(length, 10) || 16;
  if (length < 1) length = 1;
  if (length > 19) length = 19;

  const bodyLen = Math.max(0, length - 1); // excluding check digit
  let prefixDigits = digitsOnly(prefix || '');

  if (prefixDigits.length > bodyLen) {
    prefixDigits = prefixDigits.slice(0, bodyLen);
  }

  let body = prefixDigits;
  while (body.length < bodyLen) {
    body += String(Math.floor(Math.random() * 10));
  }

  const check = computeLuhnCheckDigit(body);
  return (body + check);
}

// ----------------- Generator handler -----------------
generateBtn.addEventListener('click', () => {
  const len = parseInt(generateLength.value, 10) || 16;
  const prefix = generatePrefix.value || '';
  const generated = generateLuhn(len, prefix);
  setRawDigits(generated);

  // if mask enabled we want to stay masked; leave mask state but show a result message
  result.className = 'result good';
  result.textContent = `Generated valid ${generated.length}-digit Luhn number using prefix "${digitsOnly(prefix)}".`;
  submitBtn.disabled = false;
  helper.textContent = 'Generated test number (client-side only).';
  cardInput.focus();
  // if mask is enabled, ensure the masked display is shown (we're not in editing mode)
  if (maskEnabled) {
    editing = false;
    cardInput.value = getDisplayedValue();
  }
});

// ----------------- Submit -----------------
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!rawDigits) {
    showNeutral();
    return;
  }
  const valid = luhnCheck(rawDigits);
  if (valid) {
    result.className = 'result good';
    result.textContent = `Valid card number detected (${detectCardType(rawDigits)}).`;
  } else {
    result.className = 'result bad';
    result.textContent = 'Invalid card number (Luhn failed).';
  }
});

// ----------------- Initialization -----------------
function initialize() {
  setRawDigits('');
  updateCardIcon('Unknown');
  // default eye state: masked enabled
  toggleMaskBtn.classList.remove('active');
  toggleMaskBtn.setAttribute('aria-label', 'Show card number');
  renderLuhnDetails('');
  showNeutral();
}

initialize();