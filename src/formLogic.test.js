import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_STAY_DAYS,
  buildPayload,
  createTestFormData,
  getStayDates,
  validateForm,
} from "./formLogic.js";

const valid = (changes = {}) => ({ ...createTestFormData(), ...changes });

test("the test data passes validation", () => {
  assert.deepEqual(validateForm(valid()), []);
});

test("stay dates include arrival and departure", () => {
  assert.deepEqual(getStayDates("2027-06-18", "2027-06-20"), ["2027-06-18", "2027-06-19", "2027-06-20"]);
  assert.deepEqual(getStayDates("2027-06-20", "2027-06-18"), []);
});

test("a half-typed year does not build a huge stay", () => {
  assert.deepEqual(getStayDates("0002-06-18", "2027-06-20"), []);
  assert.equal(getStayDates("2027-01-01", "2027-03-01").length, MAX_STAY_DAYS);
  assert.match(validateForm(valid({ startDate: "0002-06-18" })).join(), /at most 60 days/);
});

test("departure before arrival is rejected", () => {
  assert.match(validateForm(valid({ endDate: "2027-06-17" })).join(), /cannot be before/);
});

test("activities outside the stay are rejected", () => {
  const activities = [{ date: "2027-07-01", time: "", activity: "Kayaking" }];
  assert.match(validateForm(valid({ activities })).join(), /activity date/);
});

test("email must look like an address", () => {
  assert.match(validateForm(valid({ email: "jordan@gmail" })).join(), /full address/);
});

test("guest and allergy counts must be whole numbers", () => {
  assert.match(validateForm(valid({ approxTotalGuests: "2.5" })).join(), /Estimated Total Guests must be a whole number/);
  assert.match(validateForm(valid({ approxTotalGuests: "0" })).join(), /Estimated Total Guests must be a whole number of 1/);
  const allergies = [{ count: "-3", name: "Gluten Free" }];
  assert.match(validateForm(valid({ allergies })).join(), /Allergy 1: # Guests/);
});

test("payload sends only meals inside the stay, and blanks as null", () => {
  const form = valid({
    endDate: "2027-06-19",
    approxAdultGuests: "",
    allergies: [{ count: "", name: "" }, { count: "2", name: " Vegan " }],
  });
  const payload = buildPayload(form);
  assert.deepEqual(Object.keys(payload.mealSchedule), ["2027-06-18", "2027-06-19"]);
  assert.equal(payload.numberOfMeals, 4);
  assert.equal(payload.numberOfNights, 1);
  assert.equal(payload.approxAdultGuests, null);
  assert.deepEqual(payload.allergies, [{ count: 2, name: "Vegan" }]);
});
