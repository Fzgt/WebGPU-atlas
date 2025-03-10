export const hex2rgb = (hex: string) => {
    const r = +`0x${hex.slice(1, 3)}` / 255;
    const g = +`0x${hex.slice(3, 5)}` / 255;
    const b = +`0x${hex.slice(5, 7)}` / 255;
    return [r, g, b] as const;
};
