/*
  Pure form logic: no React, no DOM.
  Kept apart from App.jsx so `npm test` can check it with Node alone.
*/

export const MEAL_TYPES = [
  { key: "breakfast", label: "Breakfast", shortLabel: "B" },
  { key: "lunch", label: "Lunch", shortLabel: "L" },
  { key: "dinner", label: "Dinner", shortLabel: "D" },
];

// Longer stays are almost surely a typo, and each day adds a meal-table row.
export const MAX_STAY_DAYS = 60;

const DAY_MS = 1000 * 60 * 60 * 24;

export const BLANK_ROWS = {
  allergies: { count: "", name: "" },
  activities: { date: "", time: "", activity: "" },
};

export const INITIAL_FORM = {
  /* Guest Group */
  organizationName: "",
  contactName: "",
  startDate: "",
  arrivalTime: "",
  endDate: "",
  departureTime: "",
  phone: "",
  email: "",
  mailingAddress: "",

  /* Approximate Guests */
  approxTotalGuests: "",
  approxAdultGuests: "",
  approxChildren3to17: "",
  approxChildrenUnder3: "",

  /* Documents / Payment */
  contractReturnedDate: "",
  depositSentDate: "",
  depositAmount: "",
  insuranceCertificateSentDate: "",
  paymentMethod: "",

  /* Meals */
  mealSchedule: {},
  breakfastTime: "",
  lunchTime: "",
  dinnerTime: "",
  allergies: [{ ...BLANK_ROWS.allergies }],
  allergyNotes: "",
  mealNotes: "",

  /* Activities */
  activities: [{ ...BLANK_ROWS.activities }],

  /* Linens */
  linenOption: "No",
  linenSets: "",
  linenPieces: "",

  /* Notes */
  notes: "",

  /* Spam honeypot */
  website: "",
};

/*
  Development helper and test fixture. It fills the form but does not
  submit anything until the normal Submit Group Form button is pressed.
*/
export function createTestFormData() {
  return {
    ...INITIAL_FORM,

    organizationName: "000000000000000Test Community Church",
    contactName: "Jordan Test",
    startDate: "2027-06-18",
    arrivalTime: "16:00",
    endDate: "2027-06-20",
    departureTime: "13:00",
    phone: "603-555-0147",
    email: "jordan.test@example.com",
    mailingAddress: "123 Test Street, Nashua, NH 03060",

    approxTotalGuests: "50",
    approxAdultGuests: "32",
    approxChildren3to17: "15",
    approxChildrenUnder3: "3",

    contractReturnedDate: "2027-05-15",
    depositSentDate: "2027-05-16",
    depositAmount: "250",
    insuranceCertificateSentDate: "2027-06-01",
    paymentMethod: "Check",

    mealSchedule: {
      "2027-06-18": { breakfast: false, lunch: false, dinner: true },
      "2027-06-19": { breakfast: true, lunch: true, dinner: true },
      "2027-06-20": { breakfast: true, lunch: true, dinner: false },
    },
    breakfastTime: "08:00",
    lunchTime: "12:00",
    dinnerTime: "18:00",
    allergies: [
      { count: "2", name: "Gluten Free" },
      { count: "1", name: "Peanut Allergy" },
      { count: "1", name: "Dairy Free" },
    ],
    allergyNotes: "Peanut allergy is severe. Please avoid cross-contamination.",
    mealNotes:
      "Saturday dinner may need to be served at 5:30 PM because of the evening activity.",

    activities: [
      { date: "2027-06-19", time: "14:00", activity: "Hebron: Rock Wall" },
      { date: "2027-06-19", time: "19:30", activity: "Fire Pit" },
      { date: "2027-06-20", time: "09:30", activity: "Kayaking" },
    ],

    linenOption: "Some",
    linenSets: "12",
    linenPieces: "6",

    notes:
      "TEST SUBMISSION — This is fake development data. The group is interested in flexible meeting space and may update final attendance later.",

    /* Spam honeypot must stay empty */
    website: "",
  };
}

/* =========================================================
   DATE / TOTAL HELPERS
========================================================= */

function parseDateInputAsUTC(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/*
  Every date of the stay, arrival and departure included.
  Empty when the dates are missing, reversed, or longer than MAX_STAY_DAYS.
  The cap matters while typing: a half-typed year like 0002 would
  otherwise build hundreds of thousands of meal rows and hang the tab.
*/
export function getStayDates(startDate, endDate) {
  const start = parseDateInputAsUTC(startDate);
  const end = parseDateInputAsUTC(endDate);

  if (!start || !end || end < start) return [];
  if (Math.round((end - start) / DAY_MS) + 1 > MAX_STAY_DAYS) return [];

  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function formatMealDate(value) {
  const parsed = parseDateInputAsUTC(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/*
  Meal picks are kept when the dates change, so a guest who fixes a
  typo does not lose them. Only the days inside the stay count or get sent.
*/
export function getStayMealSchedule(mealSchedule, stayDates) {
  return Object.fromEntries(
    stayDates
      .filter((date) => mealSchedule?.[date])
      .map((date) => [date, mealSchedule[date]])
  );
}

export function getMealTotals(mealSchedule) {
  const totals = { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
  Object.values(mealSchedule).forEach((day) => {
    MEAL_TYPES.forEach((meal) => {
      if (day?.[meal.key]) {
        totals[meal.key] += 1;
        totals.total += 1;
      }
    });
  });
  return totals;
}

const isBlank = (value) => String(value ?? "").trim() === "";

export function getGuestBreakdownTotal(formData) {
  const values = [
    formData.approxAdultGuests,
    formData.approxChildren3to17,
    formData.approxChildrenUnder3,
  ];
  if (values.every(isBlank)) return null;
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

/* =========================================================
   VALIDATION
========================================================= */

export function validateForm(formData) {
  const errors = [];
  const { startDate, endDate } = formData;

  if (!formData.organizationName.trim()) errors.push("Guest Group Name is required.");
  if (!formData.contactName.trim()) errors.push("Primary Contact is required.");
  if (!startDate) errors.push("Arrival date is required.");
  if (!endDate) errors.push("Departure date is required.");

  if (startDate && endDate) {
    if (endDate < startDate) {
      errors.push("Departure date cannot be before the arrival date.");
    } else if (getStayDates(startDate, endDate).length === 0) {
      errors.push(`Stays can be at most ${MAX_STAY_DAYS} days. Please check the dates.`);
    }

    // The date picker's min/max are only hints; noValidate means nothing enforces them.
    const outsideStay = formData.activities.some(
      (activity) => activity.date && (activity.date < startDate || activity.date > endDate)
    );
    if (outsideStay) {
      errors.push("Every activity date must be between the arrival and departure dates.");
    }
  }

  const email = formData.email.trim();
  if (!email) {
    errors.push("Email is required.");
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.push("Email must be a full address, like name@example.com.");
  }

  if (!formData.phone.trim()) errors.push("Phone is required.");

  if (isBlank(formData.approxTotalGuests)) errors.push("Estimated Total Guests is required.");

  const wholeNumberFields = [
    { label: "Estimated Total Guests", value: formData.approxTotalGuests, min: 1 },
    { label: "Adults", value: formData.approxAdultGuests, min: 0 },
    { label: "Children ages 3–17", value: formData.approxChildren3to17, min: 0 },
    { label: "Children under 3", value: formData.approxChildrenUnder3, min: 0 },
    { label: "# of Full Linen Sets", value: formData.linenSets, min: 0 },
    { label: "# of Linen Pieces", value: formData.linenPieces, min: 0 },
    ...formData.allergies.map((allergy, index) => ({
      label: `Allergy ${index + 1}: # Guests`,
      value: allergy.count,
      min: 1,
    })),
  ];

  wholeNumberFields.forEach(({ label, value, min }) => {
    if (isBlank(value)) return;
    const number = Number(String(value).trim());
    if (!Number.isInteger(number) || number < min) {
      errors.push(`${label} must be a whole number of ${min} or greater.`);
    }
  });

  if (!isBlank(formData.depositAmount)) {
    const deposit = Number(formData.depositAmount);
    if (!Number.isFinite(deposit) || deposit < 0) {
      errors.push("Deposit Amount cannot be negative.");
    }
  }

  return errors;
}

/* =========================================================
   PAYLOAD
========================================================= */

export const numOrNull = (value) => (isBlank(value) ? null : Number(value));

const trimmed = (value) => String(value ?? "").trim();

/*
  These names are deliberately close to the staff CreateBooking
  field names so converting an approved inquiry later is straightforward.
*/
export function buildPayload(formData) {
  const stayDates = getStayDates(formData.startDate, formData.endDate);
  const mealSchedule = getStayMealSchedule(formData.mealSchedule, stayDates);

  return {
    organizationName: trimmed(formData.organizationName),
    contactName: trimmed(formData.contactName),
    startDate: formData.startDate,
    arrivalTime: formData.arrivalTime,
    endDate: formData.endDate,
    departureTime: formData.departureTime,
    phone: trimmed(formData.phone),
    email: trimmed(formData.email),
    mailingAddress: trimmed(formData.mailingAddress),

    approxTotalGuests: Number(formData.approxTotalGuests),
    approxAdultGuests: numOrNull(formData.approxAdultGuests),
    approxChildren3to17: numOrNull(formData.approxChildren3to17),
    approxChildrenUnder3: numOrNull(formData.approxChildrenUnder3),
    numberOfNights: stayDates.length > 0 ? stayDates.length - 1 : null,

    contractReturnedDate: formData.contractReturnedDate,
    // Guest terminology: "sent", not "received". Staff review these before converting.
    depositSentDate: formData.depositSentDate,
    depositAmount: numOrNull(formData.depositAmount),
    insuranceCertificateSentDate: formData.insuranceCertificateSentDate,
    paymentMethod: formData.paymentMethod,

    mealSchedule,
    numberOfMeals: getMealTotals(mealSchedule).total,
    breakfastTime: formData.breakfastTime,
    lunchTime: formData.lunchTime,
    dinnerTime: formData.dinnerTime,
    allergies: formData.allergies
      .filter((allergy) => !isBlank(allergy.name) || !isBlank(allergy.count))
      .map((allergy) => ({ count: numOrNull(allergy.count), name: trimmed(allergy.name) })),
    allergyNotes: trimmed(formData.allergyNotes),
    mealNotes: trimmed(formData.mealNotes),

    activities: formData.activities
      .filter((activity) => activity.date || activity.time || activity.activity)
      .map(({ date, time, activity }) => ({ date, time, activity })),

    linenOption: formData.linenOption,
    linenSets: numOrNull(formData.linenSets),
    linenPieces: numOrNull(formData.linenPieces),

    notes: trimmed(formData.notes),
  };
}
