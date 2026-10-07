export const EMS_DISPOSITION_OPTIONS = [
    'TRANSPORT', 'REFUSAL', 'NO PATIENT', 'NO CREW/MA',
    'OTHER EMS XPORT', '76 COVERAGE', '2ND RUN', 'CANCELLED'
];

// Keep the existing text field and CSV column compatible with older single selections.
export function getEmsDispositions(value) {
    const values = Array.isArray(value) ? value : [value];
    return [...new Set(values.flatMap(item => String(item ?? '').split(';'))
        .map(item => item.trim().toUpperCase()).filter(Boolean))];
}

export function formatEmsDispositions(value) {
    return getEmsDispositions(value).join('; ');
}
