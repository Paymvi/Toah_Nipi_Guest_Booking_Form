import { useState } from "react";
import {
  BLANK_ROWS,
  INITIAL_FORM,
  MAX_STAY_DAYS,
  MEAL_TYPES,
  buildPayload,
  createTestFormData,
  formatMealDate,
  getGuestBreakdownTotal,
  getMealTotals,
  getNumberOfNights,
  getStayDates,
  getStayMealSchedule,
  validateForm,
} from "./formLogic";
import ThemeToggle from "./ThemeToggle";
import "./App.css";

/* =========================================================
   OPTIONS
========================================================= */

const PAYMENT_METHODS = ["Check", "Credit Card", "Debit Card", "ACH", "Ramp", "Cash", "Stripe", "Other"];

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

/* =========================================================
   SMALL PIECES
========================================================= */

const REQUIRED = <b aria-hidden="true">*</b>;

const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

// One ID per filled-in form, so the server can ignore a retry of a request it already saved.
const newSubmissionId = () => crypto.randomUUID();

function SectionHeader({ number, title, children }) {
  return (
    <header className="guest-section-header">
      <div className="guest-section-number">{number}</div>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </header>
  );
}

function ErrorAlert({ title, children }) {
  return (
    <div className="guest-alert guest-alert-error" role="alert">
      <div className="guest-alert-icon" aria-hidden="true">
        !
      </div>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submissionId, setSubmissionId] = useState(newSubmissionId);
  const [validationErrors, setValidationErrors] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const stayDates = getStayDates(formData.startDate, formData.endDate);
  const numberOfNights = getNumberOfNights(stayDates);
  const mealTotals = getMealTotals(getStayMealSchedule(formData.mealSchedule, stayDates));
  const guestBreakdownTotal = getGuestBreakdownTotal(formData);
  const breakdownMatches = guestBreakdownTotal === Number(formData.approxTotalGuests);

  /* =======================================================
     TEST DATA HELPER
  ======================================================= */

  const populateTestData = () => {
    setFormData(createTestFormData());
    setSubmissionId(newSubmissionId());
    setValidationErrors([]);
    setSubmitError("");
    scrollToTop();
  };

  /* =======================================================
     BASIC FIELD CHANGE
  ======================================================= */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => {
      const updated = { ...current, [name]: value };

      // No linens means the quantity fields should be empty too.
      if (name === "linenOption" && value === "No") {
        updated.linenSets = "";
        updated.linenPieces = "";
      }

      return updated;
    });

    // The validation list stays until the next submit, so guests can work through it.
    if (submitError) setSubmitError("");
  };

  /* =======================================================
     MEALS
  ======================================================= */

  const handleMealToggle = (date, mealKey) => {
    setFormData((current) => {
      const currentDay = current.mealSchedule?.[date] || {
        breakfast: false,
        lunch: false,
        dinner: false,
      };

      return {
        ...current,
        mealSchedule: {
          ...current.mealSchedule,
          [date]: { ...currentDay, [mealKey]: !currentDay[mealKey] },
        },
      };
    });
  };

  /* =======================================================
     ALLERGY / ACTIVITY ROWS
     list is "allergies" or "activities".
  ======================================================= */

  const updateRow = (list, index, field, value) => {
    setFormData((current) => ({
      ...current,
      [list]: current[list].map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }));
  };

  const addRow = (list) => {
    setFormData((current) => ({
      ...current,
      [list]: [...current[list], { ...BLANK_ROWS[list] }],
    }));
  };

  // Each list always keeps one row so its inputs never disappear.
  const removeRow = (list, index) => {
    setFormData((current) => {
      const rows = current[list].filter((_, rowIndex) => rowIndex !== index);
      return {
        ...current,
        [list]: rows.length > 0 ? rows : [{ ...BLANK_ROWS[list] }],
      };
    });
  };

  /* =======================================================
     SUBMIT
  ======================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateForm(formData);

    if (errors.length > 0) {
      setValidationErrors(errors);
      scrollToTop();
      return;
    }

    // Honeypot field. Real users never see this.
    if (formData.website) {
      setSubmitted(true);
      return;
    }

    const endpoint = import.meta.env.VITE_GUEST_INQUIRY_ENDPOINT;

    if (!endpoint) {
      setSubmitError("The form is ready, but VITE_GUEST_INQUIRY_ENDPOINT has not been configured yet.");
      scrollToTop();
      return;
    }

    const payload = { ...buildPayload(formData), submissionId };

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setValidationErrors([]);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // Without a time limit, a server that never answers leaves the button stuck on "Sending...".
        signal: AbortSignal.timeout(15000),
      });

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }

      if (!response.ok) {
        throw new Error(
          responseBody?.error || responseBody?.message || "Your retreat request could not be submitted."
        );
      }

      setFormData(INITIAL_FORM);
      setSubmitted(true);
      scrollToTop();
    } catch (error) {
      console.error("Guest inquiry submission failed:", error);

      setSubmitError(
        error?.name === "TimeoutError"
          ? "The server took too long to answer. Please try again."
          : error?.message || "Your retreat request could not be submitted. Please try again."
      );
      scrollToTop();
    } finally {
      setIsSubmitting(false);
    }
  };

  const startAnotherInquiry = () => {
    setFormData(INITIAL_FORM);
    setSubmissionId(newSubmissionId());
    setValidationErrors([]);
    setSubmitError("");
    setSubmitted(false);
    scrollToTop();
  };

  /* =========================================================
     SUCCESS SCREEN
  ========================================================= */

  if (submitted) {
    return (
      <main className="guest-page">
        <div className="guest-page-background" aria-hidden="true" />

        <section className="guest-shell guest-success-shell">
          <div className="guest-success-icon" aria-hidden="true">
            ✓
          </div>

          <p className="guest-eyebrow">Retreat request received</p>

          <h1>Thank you for reaching out.</h1>

          <p className="guest-success-copy">
            Your information has been sent to the Toah Nipi team for review. This submission does not
            create a confirmed reservation. A staff member will review your request and contact you about
            next steps.
          </p>

          <div className="guest-success-note">
            <strong>What happens next?</strong>
            <span>
              Staff will review your requested dates, group size, meals, activities, and other information
              before moving the request into the booking process.
            </span>
          </div>

          <button type="button" className="guest-secondary-button" onClick={startAnotherInquiry}>
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
      <div className="guest-page-background" aria-hidden="true" />

      <section className="guest-shell">
        {/* HEADER */}
        <header className="guest-hero">
          <div className="guest-brand-mark" aria-hidden="true">
            TN
          </div>

          <div className="guest-hero-copy">
            <p className="guest-eyebrow">Toah Nipi Christian Retreat Center</p>
            <h1>Group Retreat Form</h1>
            <p>
              Share the information below with our staff. Fields can be updated later as your retreat plans
              become more specific.
            </p>
          </div>

          <ThemeToggle />
        </header>

        {/* DEVELOPMENT TEST TOOL: separate from the real submit button, development builds only. */}
        {import.meta.env.DEV && (
          <div className="guest-test-toolbar">
            <div className="guest-test-toolbar-copy">
              <strong>Testing the form?</strong>
              <span>Fill every section with fake data in one click. Nothing is submitted automatically.</span>
            </div>

            <button type="button" className="guest-test-data-button" onClick={populateTestData}>
              Populate Test Data
            </button>
          </div>
        )}

        <form className="guest-form" onSubmit={handleSubmit} noValidate>
          {/* ERRORS */}
          {validationErrors.length > 0 && (
            <ErrorAlert title="Please check the following:">
              <ul>
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </ErrorAlert>
          )}

          {submitError && (
            <ErrorAlert title="We couldn't submit the form.">
              <p>{submitError}</p>
            </ErrorAlert>
          )}

          {/* 1. GUEST GROUP */}
          <section className="guest-form-section">
            <SectionHeader number={1} title="Guest Group">
              Group, contact, and requested stay information.
            </SectionHeader>

            <div className="guest-section-body">
              <div className="guest-grid guest-grid-2">
                <label className="guest-field guest-field-full">
                  <span>Guest Group Name{REQUIRED}</span>
                  <input
                    type="text"
                    name="organizationName"
                    value={formData.organizationName}
                    onChange={handleChange}
                    placeholder="Example: Community Bible Church"
                    autoComplete="organization"
                    required
                  />
                </label>

                <label className="guest-field guest-field-full">
                  <span>Primary Contact{REQUIRED}</span>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="Contact person's name"
                    autoComplete="name"
                    required
                  />
                </label>

                <div className="guest-stay-block guest-field-full">
                  <div className="guest-stay-group">
                    <div className="guest-stay-title">Arrival</div>
                    <div className="guest-stay-fields">
                      <label className="guest-field">
                        <span>Date{REQUIRED}</span>
                        <input
                          type="date"
                          name="startDate"
                          value={formData.startDate}
                          onChange={handleChange}
                          required
                        />
                      </label>

                      <label className="guest-field">
                        <span>Time</span>
                        <input
                          type="time"
                          name="arrivalTime"
                          value={formData.arrivalTime}
                          onChange={handleChange}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="guest-stay-divider">
                    <span>→</span>
                  </div>

                  <div className="guest-stay-group">
                    <div className="guest-stay-title">Departure</div>
                    <div className="guest-stay-fields">
                      <label className="guest-field">
                        <span>Date{REQUIRED}</span>
                        <input
                          type="date"
                          name="endDate"
                          min={formData.startDate || undefined}
                          value={formData.endDate}
                          onChange={handleChange}
                          required
                        />
                      </label>

                      <label className="guest-field">
                        <span>Time</span>
                        <input
                          type="time"
                          name="departureTime"
                          value={formData.departureTime}
                          onChange={handleChange}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <label className="guest-field">
                  <span>Phone{REQUIRED}</span>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="XXX-XXX-XXXX"
                    autoComplete="tel"
                    required
                  />
                </label>

                <label className="guest-field">
                  <span>Email{REQUIRED}</span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                  />
                </label>

                <label className="guest-field guest-field-full">
                  <span>Mailing Address</span>
                  <input
                    type="text"
                    name="mailingAddress"
                    value={formData.mailingAddress}
                    onChange={handleChange}
                    placeholder="Street, city, state, ZIP"
                    autoComplete="street-address"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* 2. GUEST INFORMATION */}
          <section className="guest-form-section">
            <SectionHeader number={2} title="Guest Information">
              Approximate attendance is okay at this stage.
            </SectionHeader>

            <div className="guest-section-body">
              <div className="guest-subsection">
                <h3>Approximate Guests</h3>

                <div className="guest-grid guest-guest-grid">
                  <label className="guest-field guest-total-field">
                    <span>Estimated Total Guests{REQUIRED}</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      name="approxTotalGuests"
                      value={formData.approxTotalGuests}
                      onChange={handleChange}
                      placeholder="Total estimated group size"
                      required
                    />
                  </label>

                  <label className="guest-field">
                    <span>Adults</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="approxAdultGuests"
                      value={formData.approxAdultGuests}
                      onChange={handleChange}
                      placeholder="0"
                    />
                  </label>

                  <label className="guest-field">
                    <span>Children 3–17</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="approxChildren3to17"
                      value={formData.approxChildren3to17}
                      onChange={handleChange}
                      placeholder="0"
                    />
                  </label>

                  <label className="guest-field">
                    <span>Children Under 3</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="approxChildrenUnder3"
                      value={formData.approxChildrenUnder3}
                      onChange={handleChange}
                      placeholder="0"
                    />
                  </label>
                </div>

                {guestBreakdownTotal !== null && (
                  <div className={`guest-count-check ${breakdownMatches ? "guest-count-check-match" : ""}`}>
                    <div>
                      <span>Breakdown total</span>
                      <strong>{guestBreakdownTotal}</strong>
                    </div>

                    {formData.approxTotalGuests && !breakdownMatches && (
                      <small>This does not match the estimated total above. Double check the numbers if needed.</small>
                    )}
                  </div>
                )}
              </div>

              <div className="guest-subsection">
                <h3>Stay & Meal Totals</h3>

                <div className="guest-stat-grid">
                  <div className="guest-stat-card">
                    <span># of Nights</span>
                    <strong>{numberOfNights ?? "—"}</strong>
                    <small>Auto-calculated from the dates above</small>
                  </div>

                  <div className="guest-stat-card">
                    <span># of Meals</span>
                    <strong>{mealTotals.total}</strong>
                    <small>Auto-calculated from the meal schedule below</small>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. PAYMENTS & DOCUMENTS */}
          <section className="guest-form-section">
            <SectionHeader number={3} title="Payments & Documents">
              Leave any field blank if it does not apply yet.
            </SectionHeader>

            <div className="guest-section-body">
              <div className="guest-grid guest-grid-2">
                <label className="guest-field">
                  <span>Contract Returned</span>
                  <input
                    type="date"
                    name="contractReturnedDate"
                    value={formData.contractReturnedDate}
                    onChange={handleChange}
                  />
                </label>

                <label className="guest-field">
                  <span>Deposit Sent</span>
                  <input type="date" name="depositSentDate" value={formData.depositSentDate} onChange={handleChange} />
                </label>

                <label className="guest-field">
                  <span>Deposit Amount</span>
                  <div className="guest-currency-field">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="depositAmount"
                      value={formData.depositAmount}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>
                </label>

                <label className="guest-field">
                  <span>Insurance Certificate Sent</span>
                  <input
                    type="date"
                    name="insuranceCertificateSentDate"
                    value={formData.insuranceCertificateSentDate}
                    onChange={handleChange}
                  />
                </label>

                <label className="guest-field guest-field-full">
                  <span>Payment Method</span>
                  <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                    <option value="">Select payment method</option>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          {/* 4. MEALS */}
          <section className="guest-form-section">
            <SectionHeader number={4} title="Meals">
              Select meals for each day and tell us about dietary needs.
            </SectionHeader>

            <div className="guest-section-body">
              <div className="guest-meal-panel">
                <div className="guest-meal-panel-header">
                  <div>
                    <h3>Meals by Day</h3>
                    <p>Select every meal your group is requesting.</p>
                  </div>

                  <div className="guest-meal-total">
                    <strong>{mealTotals.total}</strong>
                    <span>{mealTotals.total === 1 ? "meal" : "meals"}</span>
                  </div>
                </div>

                {!formData.startDate || !formData.endDate ? (
                  <div className="guest-empty-state">
                    Choose an arrival and departure date above to build the meal schedule.
                  </div>
                ) : stayDates.length === 0 ? (
                  <div className="guest-empty-state">
                    {formData.endDate < formData.startDate
                      ? "Departure must be on or after arrival."
                      : `Stays can be at most ${MAX_STAY_DAYS} days. Please check the dates.`}
                  </div>
                ) : (
                  <div className="guest-meal-table-wrap">
                    <table className="guest-meal-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          {MEAL_TYPES.map((meal) => (
                            <th key={meal.key}>
                              <strong>{meal.shortLabel}</strong>
                              <span>{meal.label}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {stayDates.map((date) => (
                          <tr key={date}>
                            <td className="guest-meal-date">
                              <strong>{formatMealDate(date)}</strong>
                            </td>

                            {MEAL_TYPES.map((meal) => (
                              <td key={meal.key}>
                                <label className="guest-meal-check">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(formData.mealSchedule?.[date]?.[meal.key])}
                                    onChange={() => handleMealToggle(date, meal.key)}
                                    aria-label={`${meal.label} on ${formatMealDate(date)}`}
                                  />
                                  <span aria-hidden="true" />
                                </label>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr>
                          <th>Totals</th>
                          <td>{mealTotals.breakfast}</td>
                          <td>{mealTotals.lunch}</td>
                          <td>{mealTotals.dinner}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <div className="guest-subsection">
                <h3>Meal Times</h3>

                <div className="guest-grid guest-grid-3">
                  <label className="guest-field">
                    <span>Breakfast Time</span>
                    <input type="time" name="breakfastTime" value={formData.breakfastTime} onChange={handleChange} />
                  </label>

                  <label className="guest-field">
                    <span>Lunch Time</span>
                    <input type="time" name="lunchTime" value={formData.lunchTime} onChange={handleChange} />
                  </label>

                  <label className="guest-field">
                    <span>Dinner Time</span>
                    <input type="time" name="dinnerTime" value={formData.dinnerTime} onChange={handleChange} />
                  </label>
                </div>
              </div>

              <div className="guest-subsection">
                <div className="guest-subsection-heading">
                  <div>
                    <h3>Allergies / Dietary Restrictions</h3>
                    <p>Include the number of guests affected when possible.</p>
                  </div>
                </div>

                <div className="guest-repeat-header guest-allergy-grid">
                  <span># Guests</span>
                  <span>Allergy or dietary restriction</span>
                  <span />
                </div>

                <div className="guest-repeat-list">
                  {formData.allergies.map((allergy, index) => (
                    <div className="guest-repeat-row guest-allergy-grid" key={index}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={allergy.count}
                        onChange={(event) => updateRow("allergies", index, "count", event.target.value)}
                        placeholder="1"
                        aria-label="Number of guests"
                      />

                      <input
                        type="text"
                        value={allergy.name}
                        onChange={(event) => updateRow("allergies", index, "name", event.target.value)}
                        placeholder="Example: Peanuts / tree nuts"
                        aria-label="Allergy or dietary restriction"
                      />

                      <div className="guest-repeat-actions">
                        {formData.allergies.length > 1 && (
                          <button
                            type="button"
                            className="guest-remove-button"
                            onClick={() => removeRow("allergies", index)}
                            aria-label="Remove allergy"
                            title="Remove allergy"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" className="guest-add-button" onClick={() => addRow("allergies")}>
                  + Add another allergy
                </button>

                <div className="guest-grid guest-grid-1 guest-notes-grid">
                  <label className="guest-field">
                    <span>Additional Allergy Notes</span>
                    <textarea
                      rows="3"
                      name="allergyNotes"
                      value={formData.allergyNotes}
                      onChange={handleChange}
                      placeholder="Severity, exceptions, cross-contamination concerns, or other details."
                    />
                  </label>

                  <label className="guest-field">
                    <span>Other Meal Notes</span>
                    <textarea
                      rows="3"
                      name="mealNotes"
                      value={formData.mealNotes}
                      onChange={handleChange}
                      placeholder="Skipped meals, timing notes, food service details, etc."
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* 5. ACTIVITIES */}
          <section className="guest-form-section">
            <SectionHeader number={5} title="Activities">
              Tell us which activities or spaces your group would like to request.
            </SectionHeader>

            <div className="guest-section-body">
              <div className="guest-repeat-header guest-activity-grid">
                <span>Date</span>
                <span>Time</span>
                <span>Activity</span>
                <span />
              </div>

              <div className="guest-repeat-list">
                {formData.activities.map((activity, index) => (
                  <div className="guest-repeat-row guest-activity-grid" key={index}>
                    <input
                      type="date"
                      min={formData.startDate || undefined}
                      max={formData.endDate || undefined}
                      value={activity.date}
                      onChange={(event) => updateRow("activities", index, "date", event.target.value)}
                      aria-label="Activity date"
                    />

                    <input
                      type="time"
                      value={activity.time}
                      onChange={(event) => updateRow("activities", index, "time", event.target.value)}
                      aria-label="Activity time"
                    />

                    <select
                      value={activity.activity}
                      onChange={(event) => updateRow("activities", index, "activity", event.target.value)}
                      aria-label="Activity"
                    >
                      <option value="">Select activity</option>
                      {ACTIVITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <div className="guest-repeat-actions">
                      {formData.activities.length > 1 && (
                        <button
                          type="button"
                          className="guest-remove-button"
                          onClick={() => removeRow("activities", index)}
                          aria-label="Remove activity"
                          title="Remove activity"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" className="guest-add-button" onClick={() => addRow("activities")}>
                + Add another activity
              </button>
            </div>
          </section>

          {/* 6. LINENS */}
          <section className="guest-form-section">
            <SectionHeader number={6} title="Linens">
              Lodging assignments are handled by staff. Only tell us about your linen needs here.
            </SectionHeader>

            <div className="guest-section-body">
              <div className="guest-grid guest-linen-grid">
                <label className="guest-field">
                  <span>Linen Option</span>
                  <select name="linenOption" value={formData.linenOption} onChange={handleChange}>
                    <option value="No">No linens</option>
                    <option value="All">Linens for all guests</option>
                    <option value="Some">Linens for some guests</option>
                  </select>
                </label>

                <label className="guest-field">
                  <span># of Full Sets</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="linenSets"
                    value={formData.linenSets}
                    onChange={handleChange}
                    disabled={formData.linenOption === "No"}
                    placeholder="0"
                  />
                </label>

                <label className="guest-field">
                  <span># of Linen Pieces</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="linenPieces"
                    value={formData.linenPieces}
                    onChange={handleChange}
                    disabled={formData.linenOption === "No"}
                    placeholder="0"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* 7. ADDITIONAL NOTES */}
          <section className="guest-form-section">
            <SectionHeader number={7} title="Additional Notes">
              Other information our staff should know.
            </SectionHeader>

            <div className="guest-section-body">
              <label className="guest-field">
                <span>Booking Notes</span>
                <textarea
                  rows="6"
                  maxLength="3000"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Special arrangements, accessibility needs, questions, follow-up items, or other information."
                />
                <small className="guest-character-count">{formData.notes.length}/3000</small>
              </label>
            </div>
          </section>

          {/* HONEYPOT */}
          <div className="guest-honeypot" aria-hidden="true">
            <label>
              Website
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                tabIndex="-1"
                autoComplete="off"
              />
            </label>
          </div>

          {/* SUBMIT */}
          <section className="guest-submit-card">
            <div>
              <h2>Ready to send your information?</h2>
              <p>
                Submitting this form sends your information to Toah Nipi staff for review. It does not create a
                confirmed reservation by itself.
              </p>
            </div>

            <button type="submit" className="guest-submit-button" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Submit Group Form"}
            </button>
          </section>
        </form>

        <footer className="guest-footer">
          <span>Toah Nipi Christian Retreat Center</span>
          <span className="guest-footer-dot" aria-hidden="true">
            •
          </span>
          <span>Group Retreat Form</span>
        </footer>
      </section>
    </main>
  );
}
