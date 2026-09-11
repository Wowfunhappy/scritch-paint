const SET_RECTANGULAR = 'scratch-paint/bitmap-shape/SET_RECTANGULAR';

export const setBitmapRectangular = rectangular => ({type: SET_RECTANGULAR, rectangular});

export default (state = false, action) => (action.type === SET_RECTANGULAR ? action.rectangular : state);
