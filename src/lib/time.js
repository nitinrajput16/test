const IST_OFFSET_MINUTES = 5 * 60 + 30;

function getIstDateParts(now = new Date()) {
  const istTime = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return {
    now,
    dateStr: istTime.toISOString().slice(0, 10)
  };
}

module.exports = {
  IST_OFFSET_MINUTES,
  getIstDateParts
};