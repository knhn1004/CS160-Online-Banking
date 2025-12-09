export const BILLPAY_FREQUENCY_PRESETS = [
  { label: "Daily", value: "0 9 * * *" },
  { label: "Weekly (Monday)", value: "0 9 * * 1" },
  { label: "Bi-weekly (Monday)", value: "0 9 */2 * *" },
  { label: "Monthly (1st)", value: "0 9 1 * *" },
  { label: "Custom", value: "custom" },
];

export function getBillPayFrequencyLabel(frequency: string) {
  const preset = BILLPAY_FREQUENCY_PRESETS.find((p) => p.value === frequency);
  return preset ? preset.label : frequency;
}
