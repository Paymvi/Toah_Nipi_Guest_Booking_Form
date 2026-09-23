import { useMemo, useState } from "react";
import "./App.css";

/* =========================================================
   OPTIONS
========================================================= */

const PAYMENT_METHODS = [
  "Check",
  "Credit Card",
  "Debit Card",
  "ACH",
  "Ramp",
  "Cash",
  "Stripe",
  "Other",
];

const ACTIVITY_OPTIONS = [
  "Hebron: Dining Hall",
  "Hebron: Rock Wall",
  "Hebron: Overflow",
  "Hebron: Meeting Space",
  "Bethel: Meeting Space",
  "Field: Front of Hebron",
  "Field: Back of Hebron",
  "Fire Pit",
  "Swimming",
  "Kayaking",
  "Other",
];

const MEAL_TYPES = [
  {
    key: "breakfast",
    label: "Breakfast",
    shortLabel: "B",
  },
  {
    key: "lunch",
    label: "Lunch",
    shortLabel: "L",
  },
  {
    key: "dinner",
    label: "Dinner",
    shortLabel: "D",
  },
];


/* =========================================================
   INITIAL FORM
========================================================= */

const INITIAL_FORM = {
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
  allergies: [
    {
      count: "",
      name: "",
    },
  ],
  allergyNotes: "",
  mealNotes: "",

  /* Activities */
  activities: [
    {
      date: "",
      time: "",
      activity: "",
    },
  ],

  /* Linens */
  linenOption: "No",
  linenSets: "",
  linenPieces: "",

  /* Notes */
  notes: "",

  /* Spam honeypot */
  website: "",
};


/* =========================================================
   DATE / TOTAL HELPERS
========================================================= */

function parseDateInputAsUTC(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}


function getStayDates(startDate, endDate) {
  const start = parseDateInputAsUTC(startDate);
  const end = parseDateInputAsUTC(endDate);

  if (!start || !end || end < start) {
    return [];
  }

  const dates = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}


function getNumberOfNights(startDate, endDate) {
  const start = parseDateInputAsUTC(startDate);
  const end = parseDateInputAsUTC(endDate);

  if (!start || !end || end < start) {
    return "";
  }

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  return String(
    Math.round(
      (end.getTime() - start.getTime()) /
        millisecondsPerDay
    )
  );
}


function formatMealDate(value) {
  const parsed = parseDateInputAsUTC(value);

  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}


function getMealTotals(formData) {
  const totals = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    total: 0,
  };

  Object.values(formData.mealSchedule || {}).forEach(
    (day) => {
      MEAL_TYPES.forEach((meal) => {
        if (day?.[meal.key]) {
          totals[meal.key] += 1;
          totals.total += 1;
        }
      });
    }
  );

  return totals;
}


function getGuestBreakdownTotal(formData) {
  const values = [
    formData.approxAdultGuests,
    formData.approxChildren3to17,
    formData.approxChildrenUnder3,
  ];

  const hasAnyValue =
    values.some(
      (value) =>
        String(value ?? "").trim() !== ""
    );

  if (!hasAnyValue) {
    return null;
  }

  return values.reduce(
    (total, value) =>
      total + Number(value || 0),
    0
  );
}


/* =========================================================
   VALIDATION
========================================================= */

function validateForm(formData) {
  const errors = [];

  if (!formData.organizationName.trim()) {
    errors.push(
      "Guest Group Name is required."
    );
  }

  if (!formData.contactName.trim()) {
    errors.push(
      "Primary Contact is required."
    );
  }

  if (!formData.startDate) {
    errors.push(
      "Arrival date is required."
    );
  }

  if (!formData.endDate) {
    errors.push(
      "Departure date is required."
    );
  }

  if (
    formData.startDate &&
    formData.endDate &&
    formData.endDate < formData.startDate
  ) {
    errors.push(
      "Departure date cannot be before the arrival date."
    );
  }

  if (!formData.email.trim()) {
    errors.push(
      "Email is required."
    );
  }

  if (!formData.phone.trim()) {
    errors.push(
      "Phone is required."
    );
  }

  const totalGuests =
    Number(formData.approxTotalGuests);

  if (
    !String(
      formData.approxTotalGuests
    ).trim() ||
    !Number.isFinite(totalGuests) ||
    totalGuests < 1
  ) {
    errors.push(
      "Estimated Total Guests must be at least 1."
    );
  }

  const nonNegativeWholeNumberFields = [
    {
      label: "Adults",
      value: formData.approxAdultGuests,
    },
    {
      label: "Children ages 3–17",
      value: formData.approxChildren3to17,
    },
    {
      label: "Children under 3",
      value: formData.approxChildrenUnder3,
    },
    {
      label: "# of Full Linen Sets",
      value: formData.linenSets,
    },
    {
      label: "# of Linen Pieces",
      value: formData.linenPieces,
    },
  ];

  nonNegativeWholeNumberFields.forEach(
    ({ label, value }) => {
      const text =
        String(value ?? "").trim();

      if (!text) {
        return;
      }

      const number = Number(text);

      if (
        !Number.isInteger(number) ||
        number < 0
      ) {
        errors.push(
          `${label} must be a whole number of 0 or greater.`
        );
      }
    }
  );

  if (
    String(
      formData.depositAmount ?? ""
    ).trim()
  ) {
    const deposit =
      Number(formData.depositAmount);

    if (
      !Number.isFinite(deposit) ||
      deposit < 0
    ) {
      errors.push(
        "Deposit Amount cannot be negative."
      );
    }
  }

  return errors;
}


/* =========================================================
   APP
========================================================= */

export default function App() {
  const [
    formData,
    setFormData,
  ] = useState(INITIAL_FORM);

  const [
    validationErrors,
    setValidationErrors,
  ] = useState([]);

  const [
    submitError,
    setSubmitError,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    submitted,
    setSubmitted,
  ] = useState(false);


  const stayDates = useMemo(
    () =>
      getStayDates(
        formData.startDate,
        formData.endDate
      ),
    [
      formData.startDate,
      formData.endDate,
    ]
  );


  const numberOfNights = useMemo(
    () =>
      getNumberOfNights(
        formData.startDate,
        formData.endDate
      ),
    [
      formData.startDate,
      formData.endDate,
    ]
  );


  const mealTotals = useMemo(
    () =>
      getMealTotals(formData),
    [formData.mealSchedule]
  );


  const guestBreakdownTotal =
    useMemo(
      () =>
        getGuestBreakdownTotal(
          formData
        ),
      [
        formData.approxAdultGuests,
        formData.approxChildren3to17,
        formData.approxChildrenUnder3,
      ]
    );


  /* =======================================================
     BASIC FIELD CHANGE
  ======================================================= */

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setFormData((current) => {
      const updated = {
        ...current,
        [name]: value,
      };

      /*
        If dates change, keep meal selections
        only for dates still inside the stay.
      */
      if (
        name === "startDate" ||
        name === "endDate"
      ) {
        const nextDates =
          getStayDates(
            updated.startDate,
            updated.endDate
          );

        const nextSchedule = {};

        nextDates.forEach((date) => {
          if (
            current.mealSchedule?.[date]
          ) {
            nextSchedule[date] =
              current.mealSchedule[
                date
              ];
          }
        });

        updated.mealSchedule =
          nextSchedule;
      }

      /*
        No linens means the quantity fields
        should be empty too.
      */
      if (
        name === "linenOption" &&
        value === "No"
      ) {
        updated.linenSets = "";
        updated.linenPieces = "";
      }

      return updated;
    });

    if (
      validationErrors.length > 0
    ) {
      setValidationErrors([]);
    }

    if (submitError) {
      setSubmitError("");
    }
  };


  /* =======================================================
     MEALS
  ======================================================= */

  const handleMealToggle = (
    date,
    mealKey
  ) => {
    setFormData((current) => {
      const currentDay =
        current.mealSchedule?.[
          date
        ] || {
          breakfast: false,
          lunch: false,
          dinner: false,
        };

      return {
        ...current,

        mealSchedule: {
          ...current.mealSchedule,

          [date]: {
            ...currentDay,

            [mealKey]:
              !currentDay[
                mealKey
              ],
          },
        },
      };
    });
  };


  /* =======================================================
     ALLERGIES
  ======================================================= */

  const handleAllergyChange = (
    index,
    field,
    value
  ) => {
    setFormData((current) => {
      const allergies = [
        ...current.allergies,
      ];

      allergies[index] = {
        ...allergies[index],
        [field]: value,
      };

      return {
        ...current,
        allergies,
      };
    });
  };


  const addAllergy = () => {
    setFormData((current) => ({
      ...current,

      allergies: [
        ...current.allergies,
        {
          count: "",
          name: "",
        },
      ],
    }));
  };


  const removeAllergy = (
    index
  ) => {
    setFormData((current) => {
      const allergies =
        current.allergies.filter(
          (_, allergyIndex) =>
            allergyIndex !== index
        );

      return {
        ...current,

        allergies:
          allergies.length > 0
            ? allergies
            : [
                {
                  count: "",
                  name: "",
                },
              ],
      };
    });
  };


  /* =======================================================
     ACTIVITIES
  ======================================================= */

  const handleActivityChange = (
    index,
    field,
    value
  ) => {
    setFormData((current) => {
      const activities = [
        ...current.activities,
      ];

      activities[index] = {
        ...activities[index],
        [field]: value,
      };

      return {
        ...current,
        activities,
      };
    });
  };


  const addActivity = () => {
    setFormData((current) => ({
      ...current,

      activities: [
        ...current.activities,
        {
          date: "",
          time: "",
          activity: "",
        },
      ],
    }));
  };


  const removeActivity = (
    index
  ) => {
    setFormData((current) => {
      const activities =
        current.activities.filter(
          (_, activityIndex) =>
            activityIndex !== index
        );

      return {
        ...current,

        activities:
          activities.length > 0
            ? activities
            : [
                {
                  date: "",
                  time: "",
                  activity: "",
                },
              ],
      };
    });
  };


  /* =======================================================
     SUBMIT
  ======================================================= */

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    const errors =
      validateForm(formData);

    if (errors.length > 0) {
      setValidationErrors(
        errors
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    /*
      Honeypot field.
      Real users never see this.
    */
    if (formData.website) {
      setSubmitted(true);
      return;
    }

    const endpoint =
      import.meta.env
        .VITE_GUEST_INQUIRY_ENDPOINT;

    if (!endpoint) {
      setSubmitError(
        "The form is ready, but VITE_GUEST_INQUIRY_ENDPOINT has not been configured yet."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    const cleanedAllergies =
      formData.allergies
        .filter(
          (allergy) =>
            String(
              allergy.name || ""
            ).trim() ||
            String(
              allergy.count || ""
            ).trim()
        )
        .map((allergy) => ({
          count:
            allergy.count === ""
              ? null
              : Number(
                  allergy.count
                ),

          name: String(
            allergy.name || ""
          ).trim(),
        }));

    const cleanedActivities =
      formData.activities
        .filter(
          (activity) =>
            activity.date ||
            activity.time ||
            activity.activity
        )
        .map((activity) => ({
          date:
            activity.date,

          time:
            activity.time,

          activity:
            activity.activity,
        }));

    /*
      These names are deliberately close to
      the staff CreateBooking field names so
      converting an approved inquiry later
      is straightforward.
    */
    const payload = {
      organizationName:
        formData.organizationName.trim(),

      contactName:
        formData.contactName.trim(),

      startDate:
        formData.startDate,

      arrivalTime:
        formData.arrivalTime,

      endDate:
        formData.endDate,

      departureTime:
        formData.departureTime,

      phone:
        formData.phone.trim(),

      email:
        formData.email.trim(),

      mailingAddress:
        formData.mailingAddress.trim(),

      approxTotalGuests:
        Number(
          formData.approxTotalGuests
        ),

      approxAdultGuests:
        formData.approxAdultGuests === ""
          ? null
          : Number(
              formData.approxAdultGuests
            ),

      approxChildren3to17:
        formData.approxChildren3to17 === ""
          ? null
          : Number(
              formData.approxChildren3to17
            ),

      approxChildrenUnder3:
        formData.approxChildrenUnder3 === ""
          ? null
          : Number(
              formData.approxChildrenUnder3
            ),

      numberOfNights:
        numberOfNights
          ? Number(
              numberOfNights
            )
          : null,

      contractReturnedDate:
        formData.contractReturnedDate,

      /*
        Guest terminology:
        "sent", not "received".

        Staff can review these before
        converting the inquiry.
      */
      depositSentDate:
        formData.depositSentDate,

      depositAmount:
        formData.depositAmount === ""
          ? null
          : Number(
              formData.depositAmount
            ),

      insuranceCertificateSentDate:
        formData.insuranceCertificateSentDate,

      paymentMethod:
        formData.paymentMethod,

      mealSchedule:
        formData.mealSchedule,

      numberOfMeals:
        mealTotals.total,

      breakfastTime:
        formData.breakfastTime,

      lunchTime:
        formData.lunchTime,

      dinnerTime:
        formData.dinnerTime,

      allergies:
        cleanedAllergies,

      allergyNotes:
        formData.allergyNotes.trim(),

      mealNotes:
        formData.mealNotes.trim(),

      activities:
        cleanedActivities,

      linenOption:
        formData.linenOption,

      linenSets:
        formData.linenSets === ""
          ? null
          : Number(
              formData.linenSets
            ),

      linenPieces:
        formData.linenPieces === ""
          ? null
          : Number(
              formData.linenPieces
            ),

      notes:
        formData.notes.trim(),
    };


    try {
      setIsSubmitting(true);
      setSubmitError("");
      setValidationErrors([]);

      const response =
        await fetch(
          endpoint,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      let responseBody = null;

      try {
        responseBody =
          await response.json();
      } catch {
        responseBody = null;
      }

      if (!response.ok) {
        throw new Error(
          responseBody?.error ||
            responseBody?.message ||
            "Your retreat request could not be submitted."
        );
      }

      setFormData(
        INITIAL_FORM
      );

      setSubmitted(true);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error(
        "Guest inquiry submission failed:",
        error
      );

      setSubmitError(
        error?.message ||
          "Your retreat request could not be submitted. Please try again."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsSubmitting(
        false
      );
    }
  };


  const startAnotherInquiry =
    () => {
      setFormData(
        INITIAL_FORM
      );

      setValidationErrors(
        []
      );

      setSubmitError("");

      setSubmitted(false);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };


  /* =========================================================
     SUCCESS SCREEN
  ========================================================= */

  if (submitted) {
    return (
      <main className="guest-page">
        <div
          className="guest-page-background"
          aria-hidden="true"
        />

        <section className="guest-shell guest-success-shell">
          <div
            className="guest-success-icon"
            aria-hidden="true"
          >
            ✓
          </div>

          <p className="guest-eyebrow">
            Retreat request received
          </p>

          <h1>
            Thank you for reaching out.
          </h1>

          <p className="guest-success-copy">
            Your information has been
            sent to the Toah Nipi team
            for review. This submission
            does not create a confirmed
            reservation. A staff member
            will review your request and
            contact you about next steps.
          </p>

          <div className="guest-success-note">
            <strong>
              What happens next?
            </strong>

            <span>
              Staff will review your
              requested dates, group
              size, meals, activities,
              and other information
              before moving the request
              into the booking process.
            </span>
          </div>

          <button
            type="button"
            className="guest-secondary-button"
            onClick={
              startAnotherInquiry
            }
          >
            Submit another request
          </button>
        </section>
      </main>
    );
  }


  /* =========================================================
     FORM
  ========================================================= */

  return (
    <main className="guest-page">
      <div
        className="guest-page-background"
        aria-hidden="true"
      />

      <section className="guest-shell">

        {/* ===================================================
            HEADER
        =================================================== */}

        <header className="guest-hero">
          <div
            className="guest-brand-mark"
            aria-hidden="true"
          >
            TN
          </div>

          <div className="guest-hero-copy">
            <p className="guest-eyebrow">
              Toah Nipi Christian Retreat Center
            </p>

            <h1>
              Group Retreat Form
            </h1>

            <p>
              Share the information
              below with our staff.
              Fields can be updated
              later as your retreat
              plans become more
              specific.
            </p>
          </div>
        </header>


        <form
          className="guest-form"
          onSubmit={
            handleSubmit
          }
          noValidate
        >

          {/* =================================================
              ERRORS
          ================================================= */}

          {validationErrors.length >
            0 && (
            <div
              className="guest-alert guest-alert-error"
              role="alert"
            >
              <div
                className="guest-alert-icon"
                aria-hidden="true"
              >
                !
              </div>

              <div>
                <strong>
                  Please check the
                  following:
                </strong>

                <ul>
                  {validationErrors.map(
                    (error) => (
                      <li key={error}>
                        {error}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          )}


          {submitError && (
            <div
              className="guest-alert guest-alert-error"
              role="alert"
            >
              <div
                className="guest-alert-icon"
                aria-hidden="true"
              >
                !
              </div>

              <div>
                <strong>
                  We couldn't submit
                  the form.
                </strong>

                <p>
                  {submitError}
                </p>
              </div>
            </div>
          )}


          {/* =================================================
              1. GUEST GROUP
          ================================================= */}

          <section className="guest-form-section">
            <header className="guest-section-header">
              <div className="guest-section-number">
                1
              </div>

              <div>
                <h2>
                  Guest Group
                </h2>

                <p>
                  Group, contact, and
                  requested stay
                  information.
                </p>
              </div>
            </header>


            <div className="guest-section-body">
              <div className="guest-grid guest-grid-2">

                <label className="guest-field guest-field-full">
                  <span>
                    Guest Group Name
                    <b aria-hidden="true">
                      *
                    </b>
                  </span>

                  <input
                    type="text"
                    name="organizationName"
                    value={
                      formData.organizationName
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Example: Community Bible Church"
                    autoComplete="organization"
                    required
                  />
                </label>


                <label className="guest-field guest-field-full">
                  <span>
                    Primary Contact
                    <b aria-hidden="true">
                      *
                    </b>
                  </span>

                  <input
                    type="text"
                    name="contactName"
                    value={
                      formData.contactName
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Contact person's name"
                    autoComplete="name"
                    required
                  />
                </label>


                <div className="guest-stay-block guest-field-full">

                  <div className="guest-stay-group">
                    <div className="guest-stay-title">
                      Arrival
                    </div>

                    <div className="guest-stay-fields">
                      <label className="guest-field">
                        <span>
                          Date
                          <b aria-hidden="true">
                            *
                          </b>
                        </span>

                        <input
                          type="date"
                          name="startDate"
                          value={
                            formData.startDate
                          }
                          onChange={
                            handleChange
                          }
                          required
                        />
                      </label>

                      <label className="guest-field">
                        <span>
                          Time
                        </span>

                        <input
                          type="time"
                          name="arrivalTime"
                          value={
                            formData.arrivalTime
                          }
                          onChange={
                            handleChange
                          }
                        />
                      </label>
                    </div>
                  </div>


                  <div className="guest-stay-divider">
                    <span>
                      →
                    </span>
                  </div>


                  <div className="guest-stay-group">
                    <div className="guest-stay-title">
                      Departure
                    </div>

                    <div className="guest-stay-fields">
                      <label className="guest-field">
                        <span>
                          Date
                          <b aria-hidden="true">
                            *
                          </b>
                        </span>

                        <input
                          type="date"
                          name="endDate"
                          min={
                            formData.startDate ||
                            undefined
                          }
                          value={
                            formData.endDate
                          }
                          onChange={
                            handleChange
                          }
                          required
                        />
                      </label>

                      <label className="guest-field">
                        <span>
                          Time
                        </span>

                        <input
                          type="time"
                          name="departureTime"
                          value={
                            formData.departureTime
                          }
                          onChange={
                            handleChange
                          }
                        />
                      </label>
                    </div>
                  </div>

                </div>


                <label className="guest-field">
                  <span>
                    Phone
                    <b aria-hidden="true">
                      *
                    </b>
                  </span>

                  <input
                    type="tel"
                    name="phone"
                    value={
                      formData.phone
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="XXX-XXX-XXXX"
                    autoComplete="tel"
                    required
                  />
                </label>


                <label className="guest-field">
                  <span>
                    Email
                    <b aria-hidden="true">
                      *
                    </b>
                  </span>

                  <input
                    type="email"
                    name="email"
                    value={
                      formData.email
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                  />
                </label>


                <label className="guest-field guest-field-full">
                  <span>
                    Mailing Address
                  </span>

                  <input
                    type="text"
                    name="mailingAddress"
                    value={
                      formData.mailingAddress
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Street, city, state, ZIP"
                    autoComplete="street-address"
                  />
                </label>

              </div>
            </div>
          </section>


          {/* =================================================
              2. GUEST INFORMATION
          ================================================= */}

          <section className="guest-form-section">
            <header className="guest-section-header">
              <div className="guest-section-number">
                2
              </div>

              <div>
                <h2>
                  Guest Information
                </h2>

                <p>
                  Approximate attendance
                  is okay at this stage.
                </p>
              </div>
            </header>


            <div className="guest-section-body">

              <div className="guest-subsection">
                <h3>
                  Approximate Guests
                </h3>

                <div className="guest-grid guest-guest-grid">

                  <label className="guest-field guest-total-field">
                    <span>
                      Estimated Total Guests
                      <b aria-hidden="true">
                        *
                      </b>
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      name="approxTotalGuests"
                      value={
                        formData.approxTotalGuests
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Total estimated group size"
                      required
                    />
                  </label>


                  <label className="guest-field">
                    <span>
                      Adults
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="approxAdultGuests"
                      value={
                        formData.approxAdultGuests
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0"
                    />
                  </label>


                  <label className="guest-field">
                    <span>
                      Children 3–17
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="approxChildren3to17"
                      value={
                        formData.approxChildren3to17
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0"
                    />
                  </label>


                  <label className="guest-field">
                    <span>
                      Children Under 3
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="approxChildrenUnder3"
                      value={
                        formData.approxChildrenUnder3
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0"
                    />
                  </label>

                </div>


                {guestBreakdownTotal !==
                  null && (
                  <div
                    className={`guest-count-check ${
                      guestBreakdownTotal ===
                      Number(
                        formData.approxTotalGuests
                      )
                        ? "guest-count-check-match"
                        : ""
                    }`}
                  >
                    <div>
                      <span>
                        Breakdown total
                      </span>

                      <strong>
                        {
                          guestBreakdownTotal
                        }
                      </strong>
                    </div>

                    {formData.approxTotalGuests &&
                      guestBreakdownTotal !==
                        Number(
                          formData.approxTotalGuests
                        ) && (
                        <small>
                          This does not
                          match the
                          estimated total
                          above. Double
                          check the
                          numbers if
                          needed.
                        </small>
                      )}
                  </div>
                )}

              </div>


              <div className="guest-subsection">
                <h3>
                  Stay & Meal Totals
                </h3>

                <div className="guest-stat-grid">

                  <div className="guest-stat-card">
                    <span>
                      # of Nights
                    </span>

                    <strong>
                      {
                        numberOfNights ||
                        "—"
                      }
                    </strong>

                    <small>
                      Auto-calculated
                      from the dates
                      above
                    </small>
                  </div>


                  <div className="guest-stat-card">
                    <span>
                      # of Meals
                    </span>

                    <strong>
                      {
                        mealTotals.total
                      }
                    </strong>

                    <small>
                      Auto-calculated
                      from the meal
                      schedule below
                    </small>
                  </div>

                </div>
              </div>

            </div>
          </section>


          {/* =================================================
              3. PAYMENTS & DOCUMENTS
          ================================================= */}

          <section className="guest-form-section">
            <header className="guest-section-header">
              <div className="guest-section-number">
                3
              </div>

              <div>
                <h2>
                  Payments & Documents
                </h2>

                <p>
                  Leave any field blank
                  if it does not apply
                  yet.
                </p>
              </div>
            </header>


            <div className="guest-section-body">
              <div className="guest-grid guest-grid-2">

                <label className="guest-field">
                  <span>
                    Contract Returned
                  </span>

                  <input
                    type="date"
                    name="contractReturnedDate"
                    value={
                      formData.contractReturnedDate
                    }
                    onChange={
                      handleChange
                    }
                  />
                </label>


                <label className="guest-field">
                  <span>
                    Deposit Sent
                  </span>

                  <input
                    type="date"
                    name="depositSentDate"
                    value={
                      formData.depositSentDate
                    }
                    onChange={
                      handleChange
                    }
                  />
                </label>


                <label className="guest-field">
                  <span>
                    Deposit Amount
                  </span>

                  <div className="guest-currency-field">
                    <span>
                      $
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="depositAmount"
                      value={
                        formData.depositAmount
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                    />
                  </div>
                </label>


                <label className="guest-field">
                  <span>
                    Insurance Certificate Sent
                  </span>

                  <input
                    type="date"
                    name="insuranceCertificateSentDate"
                    value={
                      formData.insuranceCertificateSentDate
                    }
                    onChange={
                      handleChange
                    }
                  />
                </label>


                <label className="guest-field guest-field-full">
                  <span>
                    Payment Method
                  </span>

                  <select
                    name="paymentMethod"
                    value={
                      formData.paymentMethod
                    }
                    onChange={
                      handleChange
                    }
                  >
                    <option value="">
                      Select payment method
                    </option>

                    {PAYMENT_METHODS.map(
                      (method) => (
                        <option
                          key={
                            method
                          }
                          value={
                            method
                          }
                        >
                          {
                            method
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

              </div>
            </div>
          </section>


          {/* =================================================
              4. MEALS
          ================================================= */}

          <section className="guest-form-section">
            <header className="guest-section-header">
              <div className="guest-section-number">
                4
              </div>

              <div>
                <h2>
                  Meals
                </h2>

                <p>
                  Select meals for each
                  day and tell us about
                  dietary needs.
                </p>
              </div>
            </header>


            <div className="guest-section-body">

              <div className="guest-meal-panel">

                <div className="guest-meal-panel-header">
                  <div>
                    <h3>
                      Meals by Day
                    </h3>

                    <p>
                      Select every meal
                      your group is
                      requesting.
                    </p>
                  </div>

                  <div className="guest-meal-total">
                    <strong>
                      {
                        mealTotals.total
                      }
                    </strong>

                    <span>
                      {
                        mealTotals.total ===
                        1
                          ? "meal"
                          : "meals"
                      }
                    </span>
                  </div>
                </div>


                {!formData.startDate ||
                !formData.endDate ? (
                  <div className="guest-empty-state">
                    Choose an arrival
                    and departure date
                    above to build the
                    meal schedule.
                  </div>
                ) : stayDates.length ===
                  0 ? (
                  <div className="guest-empty-state">
                    Departure must be
                    on or after arrival.
                  </div>
                ) : (
                  <div className="guest-meal-table-wrap">
                    <table className="guest-meal-table">

                      <thead>
                        <tr>
                          <th>
                            Date
                          </th>

                          {MEAL_TYPES.map(
                            (meal) => (
                              <th
                                key={
                                  meal.key
                                }
                              >
                                <strong>
                                  {
                                    meal.shortLabel
                                  }
                                </strong>

                                <span>
                                  {
                                    meal.label
                                  }
                                </span>
                              </th>
                            )
                          )}
                        </tr>
                      </thead>


                      <tbody>
                        {stayDates.map(
                          (date) => (
                            <tr
                              key={
                                date
                              }
                            >
                              <td className="guest-meal-date">
                                <strong>
                                  {
                                    formatMealDate(
                                      date
                                    )
                                  }
                                </strong>
                              </td>

                              {MEAL_TYPES.map(
                                (
                                  meal
                                ) => {
                                  const checked =
                                    Boolean(
                                      formData
                                        .mealSchedule?.[
                                        date
                                      ]?.[
                                        meal
                                          .key
                                      ]
                                    );

                                  return (
                                    <td
                                      key={
                                        meal.key
                                      }
                                    >
                                      <label className="guest-meal-check">
                                        <input
                                          type="checkbox"
                                          checked={
                                            checked
                                          }
                                          onChange={() =>
                                            handleMealToggle(
                                              date,
                                              meal.key
                                            )
                                          }
                                          aria-label={`${meal.label} on ${formatMealDate(
                                            date
                                          )}`}
                                        />

                                        <span
                                          aria-hidden="true"
                                        />
                                      </label>
                                    </td>
                                  );
                                }
                              )}
                            </tr>
                          )
                        )}
                      </tbody>


                      <tfoot>
                        <tr>
                          <th>
                            Totals
                          </th>

                          <td>
                            {
                              mealTotals.breakfast
                            }
                          </td>

                          <td>
                            {
                              mealTotals.lunch
                            }
                          </td>

                          <td>
                            {
                              mealTotals.dinner
                            }
                          </td>
                        </tr>
                      </tfoot>

                    </table>
                  </div>
                )}

              </div>


              <div className="guest-subsection">
                <h3>
                  Meal Times
                </h3>

                <div className="guest-grid guest-grid-3">

                  <label className="guest-field">
                    <span>
                      Breakfast Time
                    </span>

                    <input
                      type="time"
                      name="breakfastTime"
                      value={
                        formData.breakfastTime
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </label>


                  <label className="guest-field">
                    <span>
                      Lunch Time
                    </span>

                    <input
                      type="time"
                      name="lunchTime"
                      value={
                        formData.lunchTime
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </label>


                  <label className="guest-field">
                    <span>
                      Dinner Time
                    </span>

                    <input
                      type="time"
                      name="dinnerTime"
                      value={
                        formData.dinnerTime
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </label>

                </div>
              </div>


              <div className="guest-subsection">
                <div className="guest-subsection-heading">
                  <div>
                    <h3>
                      Allergies / Dietary Restrictions
                    </h3>

                    <p>
                      Include the number
                      of guests affected
                      when possible.
                    </p>
                  </div>
                </div>


                <div className="guest-repeat-header guest-allergy-grid">
                  <span>
                    # Guests
                  </span>

                  <span>
                    Allergy or dietary restriction
                  </span>

                  <span />
                </div>


                <div className="guest-repeat-list">
                  {formData.allergies.map(
                    (
                      allergy,
                      index
                    ) => (
                      <div
                        className="guest-repeat-row guest-allergy-grid"
                        key={
                          index
                        }
                      >
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={
                            allergy.count
                          }
                          onChange={(
                            event
                          ) =>
                            handleAllergyChange(
                              index,
                              "count",
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="1"
                          aria-label="Number of guests"
                        />

                        <input
                          type="text"
                          value={
                            allergy.name
                          }
                          onChange={(
                            event
                          ) =>
                            handleAllergyChange(
                              index,
                              "name",
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="Example: Peanuts / tree nuts"
                          aria-label="Allergy or dietary restriction"
                        />

                        <div className="guest-repeat-actions">
                          {formData
                            .allergies
                            .length >
                            1 && (
                            <button
                              type="button"
                              className="guest-remove-button"
                              onClick={() =>
                                removeAllergy(
                                  index
                                )
                              }
                              aria-label="Remove allergy"
                              title="Remove allergy"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>


                <button
                  type="button"
                  className="guest-add-button"
                  onClick={
                    addAllergy
                  }
                >
                  + Add another allergy
                </button>


                <div className="guest-grid guest-grid-1 guest-notes-grid">

                  <label className="guest-field">
                    <span>
                      Additional Allergy Notes
                    </span>

                    <textarea
                      rows="3"
                      name="allergyNotes"
                      value={
                        formData.allergyNotes
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Severity, exceptions, cross-contamination concerns, or other details."
                    />
                  </label>


                  <label className="guest-field">
                    <span>
                      Other Meal Notes
                    </span>

                    <textarea
                      rows="3"
                      name="mealNotes"
                      value={
                        formData.mealNotes
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Skipped meals, timing notes, food service details, etc."
                    />
                  </label>

                </div>

              </div>

            </div>
          </section>


          {/* =================================================
              5. ACTIVITIES
          ================================================= */}

          <section className="guest-form-section">
            <header className="guest-section-header">
              <div className="guest-section-number">
                5
              </div>

              <div>
                <h2>
                  Activities
                </h2>

                <p>
                  Tell us which
                  activities or spaces
                  your group would like
                  to request.
                </p>
              </div>
            </header>


            <div className="guest-section-body">

              <div className="guest-repeat-header guest-activity-grid">
                <span>
                  Date
                </span>

                <span>
                  Time
                </span>

                <span>
                  Activity
                </span>

                <span />
              </div>


              <div className="guest-repeat-list">
                {formData.activities.map(
                  (
                    activity,
                    index
                  ) => (
                    <div
                      className="guest-repeat-row guest-activity-grid"
                      key={
                        index
                      }
                    >

                      <input
                        type="date"
                        min={
                          formData.startDate ||
                          undefined
                        }
                        max={
                          formData.endDate ||
                          undefined
                        }
                        value={
                          activity.date
                        }
                        onChange={(
                          event
                        ) =>
                          handleActivityChange(
                            index,
                            "date",
                            event
                              .target
                              .value
                          )
                        }
                        aria-label="Activity date"
                      />


                      <input
                        type="time"
                        value={
                          activity.time
                        }
                        onChange={(
                          event
                        ) =>
                          handleActivityChange(
                            index,
                            "time",
                            event
                              .target
                              .value
                          )
                        }
                        aria-label="Activity time"
                      />


                      <select
                        value={
                          activity.activity
                        }
                        onChange={(
                          event
                        ) =>
                          handleActivityChange(
                            index,
                            "activity",
                            event
                              .target
                              .value
                          )
                        }
                        aria-label="Activity"
                      >
                        <option value="">
                          Select activity
                        </option>

                        {ACTIVITY_OPTIONS.map(
                          (
                            option
                          ) => (
                            <option
                              key={
                                option
                              }
                              value={
                                option
                              }
                            >
                              {
                                option
                              }
                            </option>
                          )
                        )}
                      </select>


                      <div className="guest-repeat-actions">
                        {formData
                          .activities
                          .length >
                          1 && (
                          <button
                            type="button"
                            className="guest-remove-button"
                            onClick={() =>
                              removeActivity(
                                index
                              )
                            }
                            aria-label="Remove activity"
                            title="Remove activity"
                          >
                            ×
                          </button>
                        )}
                      </div>

                    </div>
                  )
                )}
              </div>


              <button
                type="button"
                className="guest-add-button"
                onClick={
                  addActivity
                }
              >
                + Add another activity
              </button>

            </div>
          </section>


          {/* =================================================
              6. LINENS
          ================================================= */}

          <section className="guest-form-section">
            <header className="guest-section-header">
              <div className="guest-section-number">
                6
              </div>

              <div>
                <h2>
                  Linens
                </h2>

                <p>
                  Lodging assignments
                  are handled by staff.
                  Only tell us about
                  your linen needs here.
                </p>
              </div>
            </header>


            <div className="guest-section-body">

              <div className="guest-grid guest-linen-grid">

                <label className="guest-field">
                  <span>
                    Linen Option
                  </span>

                  <select
                    name="linenOption"
                    value={
                      formData.linenOption
                    }
                    onChange={
                      handleChange
                    }
                  >
                    <option value="No">
                      No linens
                    </option>

                    <option value="All">
                      Linens for all guests
                    </option>

                    <option value="Some">
                      Linens for some guests
                    </option>
                  </select>
                </label>


                <label className="guest-field">
                  <span>
                    # of Full Sets
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="linenSets"
                    value={
                      formData.linenSets
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      formData.linenOption ===
                      "No"
                    }
                    placeholder="0"
                  />
                </label>


                <label className="guest-field">
                  <span>
                    # of Linen Pieces
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="linenPieces"
                    value={
                      formData.linenPieces
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      formData.linenOption ===
                      "No"
                    }
                    placeholder="0"
                  />
                </label>

              </div>

            </div>
          </section>


          {/* =================================================
              7. ADDITIONAL NOTES
          ================================================= */}

          <section className="guest-form-section">
            <header className="guest-section-header">
              <div className="guest-section-number">
                7
              </div>

              <div>
                <h2>
                  Additional Notes
                </h2>

                <p>
                  Other information our
                  staff should know.
                </p>
              </div>
            </header>


            <div className="guest-section-body">

              <label className="guest-field">
                <span>
                  Booking Notes
                </span>

                <textarea
                  rows="6"
                  maxLength="3000"
                  name="notes"
                  value={
                    formData.notes
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Special arrangements, accessibility needs, questions, follow-up items, or other information."
                />

                <small className="guest-character-count">
                  {
                    formData.notes.length
                  }
                  /3000
                </small>
              </label>

            </div>
          </section>


          {/* =================================================
              HONEYPOT
          ================================================= */}

          <div
            className="guest-honeypot"
            aria-hidden="true"
          >
            <label>
              Website

              <input
                type="text"
                name="website"
                value={
                  formData.website
                }
                onChange={
                  handleChange
                }
                tabIndex="-1"
                autoComplete="off"
              />
            </label>
          </div>


          {/* =================================================
              SUBMIT
          ================================================= */}

          <section className="guest-submit-card">
            <div>
              <h2>
                Ready to send your information?
              </h2>

              <p>
                Submitting this form
                sends your information
                to Toah Nipi staff for
                review. It does not
                create a confirmed
                reservation by itself.
              </p>
            </div>

            <button
              type="submit"
              className="guest-submit-button"
              disabled={
                isSubmitting
              }
            >
              {isSubmitting
                ? "Sending..."
                : "Submit Group Form"}
            </button>
          </section>

        </form>


        <footer className="guest-footer">
          <span>
            Toah Nipi Christian Retreat Center
          </span>

          <span
            className="guest-footer-dot"
            aria-hidden="true"
          >
            •
          </span>

          <span>
            Group Retreat Form
          </span>
        </footer>

      </section>
    </main>
  );
}
