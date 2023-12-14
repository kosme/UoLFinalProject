window.onload = function () {
  let now = new Date(Date.now());
  let data = { date: now, data: [] };
  let dateAsMoment = moment(now);
  dateAsMoment.startOf('day');
  let datePicker = document.getElementById('dayPicker');
  datePicker.value = dateAsMoment.format("YYYY-MM-DD");
  datePicker.addEventListener('input', dateChanged, false);
  const start = dateAsMoment.unix();
  const stop = dateAsMoment.add(1, 'd').unix();
  document.getElementById('patientSelector').addEventListener('change', dateChanged, false);
  fetchDayData(data, start, stop);
};
