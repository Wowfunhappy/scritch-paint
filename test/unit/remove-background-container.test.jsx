/* eslint-env jest, browser */
import React from 'react'; // eslint-disable-line no-unused-vars
import {shallow} from 'enzyme';
import {FormattedMessage} from 'react-intl';
import {RemoveBackground} from '../../src/containers/remove-background.jsx'; // eslint-disable-line no-unused-vars
import BackgroundRemover from '../../src/helper/remove-background';
import {getRaster} from '../../src/helper/layer';
import {getHitBounds} from '../../src/helper/bitmap';

jest.mock('@scratch/paper', () => ({Point: function (x, y) {
    this.x = x;
    this.y = y;
}}));
jest.mock('../../src/helper/remove-background', () => jest.fn());
jest.mock('react-intl', () => ({FormattedMessage: () => null, defineMessages: messages => messages}));
jest.mock('../../src/helper/layer', () => ({getRaster: jest.fn()}));
jest.mock('../../src/helper/bitmap', () => ({getHitBounds: jest.fn()}));
jest.mock('../../src/helper/selection', () => ({getSelectedLeafItems: () => []}));

let wrapper;
let raster;
let resolveRemoval;
let dispose;
let onUpdateImage;
let canvas;

beforeEach(() => {
    jest.useFakeTimers();
    canvas = {
        width: 2,
        height: 2,
        toDataURL: jest.fn(() => 'original pixels'),
        getContext: () => ({getImageData: () => ({data: new Uint8ClampedArray(16)})})
    };
    raster = {
        loaded: true,
        canvas,
        getImageData: jest.fn(() => ({width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255)})),
        bounds: {topLeft: {}},
        getSubRaster: () => ({canvas, remove: jest.fn()}),
        setImageData: jest.fn()
    };
    getRaster.mockReturnValue(raster);
    getHitBounds.mockReturnValue({width: 2, height: 2, topLeft: {subtract: () => ({x: 7, y: 9})}});
    dispose = jest.fn();
    BackgroundRemover.mockImplementation(() => ({
        remove: () => new Promise(resolve => {
            resolveRemoval = resolve;
        }),
        dispose
    }));
    onUpdateImage = jest.fn();
    wrapper = shallow(<RemoveBackground
        bitmapRectangular
        changeMode={jest.fn()}
        imageId="costume-a"
        mode="BIT_BRUSH"
        undo={{pointer: 0}}
        onUpdateImage={onUpdateImage}
    />);
});

afterEach(() => {
    wrapper.unmount();
    jest.useRealTimers();
});

const finishRemoval = async () => {
    resolveRemoval(canvas);
    await Promise.resolve();
    await Promise.resolve();
};

test('applies pixels at their original offset through the normal undo/update path', async () => {
    wrapper.instance().handleRemove();
    jest.runOnlyPendingTimers();
    await finishRemoval();
    expect(raster.setImageData).toHaveBeenCalledTimes(1);
    expect(raster.setImageData.mock.calls[0][1]).toEqual({x: 7, y: 9});
    expect(onUpdateImage).toHaveBeenCalledTimes(1);
    expect(wrapper.state('busy')).toBe(false);
});

test('first click survives its own batched brush activation and selection commit', async () => {
    wrapper.setProps({mode: 'BIT_SELECT'});
    wrapper.instance().handleRemove();
    expect(wrapper.state('busy')).toBe(true);
    // React flushes the click's Redux updates after the handler scheduled its timer.
    wrapper.setProps({mode: 'BIT_BRUSH', undo: {pointer: 1}});
    jest.runOnlyPendingTimers();
    expect(wrapper.state('busy')).toBe(true);
    await finishRemoval();
    expect(raster.setImageData).toHaveBeenCalledTimes(1);
    expect(onUpdateImage).toHaveBeenCalledTimes(1);
});

test.each([
    {imageId: 'costume-b'},
    {mode: 'BIT_ERASER'}
])('cancels queued work when the user changes costume or tool', props => {
    wrapper.instance().handleRemove();
    wrapper.setProps(props);
    jest.runOnlyPendingTimers();
    expect(wrapper.state('busy')).toBe(false);
    expect(wrapper.instance().request).toBeNull();
    expect(onUpdateImage).not.toHaveBeenCalled();
});

test.each(['imageId', 'undo'])('discards results when %s changes', async property => {
    wrapper.instance().handleRemove();
    jest.runOnlyPendingTimers();
    wrapper.setProps({[property]: property === 'imageId' ? 'costume-b' : {pointer: 1}});
    await finishRemoval();
    expect(dispose).toHaveBeenCalled();
    expect(raster.setImageData).not.toHaveBeenCalled();
    expect(onUpdateImage).not.toHaveBeenCalled();
});

test('discards a result if an unfinished brush stroke changed the pixels', async () => {
    wrapper.instance().handleRemove();
    jest.runOnlyPendingTimers();
    canvas.toDataURL.mockReturnValue('changed pixels');
    await finishRemoval();
    expect(raster.setImageData).not.toHaveBeenCalled();
    expect(onUpdateImage).not.toHaveBeenCalled();
});

test('does not run inference or add an undo entry for an empty bitmap', () => {
    getHitBounds.mockReturnValue({width: 0, height: 0});
    wrapper.instance().handleRemove();
    jest.runOnlyPendingTimers();
    expect(wrapper.state('busy')).toBe(false);
    expect(onUpdateImage).not.toHaveBeenCalled();
});

const getButton = () => wrapper.find(FormattedMessage).first()
    .prop('children')('Remove Background');

test('disables removal for a nonrectangular costume and re-enables it when restored', () => {
    wrapper.setProps({bitmapRectangular: false});
    expect(getButton().props.disabled).toBe(true);
    wrapper.instance().handleRemove();
    expect(wrapper.state('busy')).toBe(false);
    wrapper.setProps({bitmapRectangular: true});
    expect(getButton().props.disabled).toBe(false);
});

test('still allows clicking to cancel while busy, even if eligibility changes', async () => {
    wrapper.instance().handleRemove();
    jest.runOnlyPendingTimers();
    wrapper.setProps({bitmapRectangular: false});
    expect(getButton().props.disabled).toBe(false);
    getButton().props.onClick();
    await finishRemoval();
    expect(dispose).toHaveBeenCalled();
    expect(onUpdateImage).not.toHaveBeenCalled();
    expect(getButton().props.disabled).toBe(true);
});

test('checks current pixels again before inference after committing the selection', () => {
    raster.getImageData.mockReturnValue({width: 2, height: 2, data: new Uint8ClampedArray(16)});
    wrapper.instance().handleRemove();
    jest.runOnlyPendingTimers();
    expect(wrapper.state('busy')).toBe(false);
    expect(onUpdateImage).not.toHaveBeenCalled();
});
