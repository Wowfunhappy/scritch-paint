// Transparent outer margins don't count. Every pixel inside the visible bounds
// must have some opacity; holes, cutouts and rounded corners fail this check.
const isRectangularBitmap = ({data, width, height}) => {
    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    let visible = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(((y * width) + x) * 4) + 3] > 0) {
                visible++;
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = y;
            }
        }
    }
    return visible > 0 && visible === (right - left + 1) * (bottom - top + 1);
};

export default isRectangularBitmap;
