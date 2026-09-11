import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, FormattedMessage} from 'react-intl';
import {connect} from 'react-redux';
import paper from '@scratch/paper';
import {changeMode} from '../reducers/modes';
import Modes from '../lib/modes';
import {getRaster} from '../helper/layer';
import {getHitBounds} from '../helper/bitmap';
import {getSelectedLeafItems} from '../helper/selection';
import BackgroundRemover from '../helper/remove-background';
import isRectangularBitmap from '../helper/is-rectangular-bitmap';
import styles from '../components/paint-editor/paint-editor.css';
import labeledIconStyles from '../components/labeled-icon-button/labeled-icon-button.css';
import removeBackgroundIcon from '../components/paint-editor/icons/remove-background.svg';
import closeIcon from '../components/paint-editor/icons/close.svg';
import log from '../log/log';

const messages = defineMessages({
    remove: {
        defaultMessage: 'Remove Background',
        description: 'Remove the bitmap background using local AI',
        id: 'paint.backgroundRemoval.remove'
    },
    cancel: {
        defaultMessage: 'Cancel background removal',
        description: 'Cancel background removal using the busy icon button',
        id: 'paint.backgroundRemoval.cancelAction'
    },
    removing: {
        defaultMessage: 'Removing...',
        description: 'Label while background removal is working',
        id: 'paint.backgroundRemoval.removingLabel'
    },
    cancelLabel: {
        defaultMessage: 'Cancel',
        description: 'Label when hovering over background removal in progress',
        id: 'paint.backgroundRemoval.cancelLabel'
    }
});

class RemoveBackground extends React.Component {
    constructor (props) {
        super(props);
        this.state = {busy: false, error: false};
        this.handleRemove = this.handleRemove.bind(this);
        this.cancel = this.cancel.bind(this);
        this.handleCancel = this.cancel;
    }
    componentDidUpdate (previous) {
        const modeChanged = previous.mode !== this.props.mode;
        // Before the timer runs, our own brush activation can commit a selection
        // and update undo. React batches those updates until after the click handler.
        // Once inference starts, any further edit must invalidate its snapshot.
        if (previous.imageId !== this.props.imageId ||
            (this.request && (previous.undo !== this.props.undo || modeChanged)) ||
            (this.timer && modeChanged && this.props.mode !== Modes.BIT_BRUSH)) {
            this.cancel();
        }
    }
    componentWillUnmount () {
        this.request = null;
        clearTimeout(this.timer);
        if (this.remover) this.remover.dispose();
    }
    cancel () {
        this.request = null;
        clearTimeout(this.timer);
        this.timer = null;
        if (this.remover) this.remover.dispose();
        this.setState({busy: false, error: false});
    }
    handleRemove () {
        if (this.state.busy || this.timer || !this.props.bitmapRectangular) return;
        this.setState({busy: true, error: false});
        // Deactivating selection/text tools commits floating artwork before reading the bitmap.
        this.props.changeMode(Modes.BIT_BRUSH);
        this.timer = setTimeout(async () => {
            this.timer = null;
            const request = {};
            this.request = request;
            this.setState({busy: true, error: false});
            try {
                const raster = getRaster();
                if (!raster.loaded || getSelectedLeafItems().length) throw new Error('Bitmap is not ready');
                const bounds = getHitBounds(raster);
                if (!bounds.width || !bounds.height || !isRectangularBitmap(raster.getImageData())) {
                    this.cancel();
                    return;
                }
                const original = raster.canvas.toDataURL();
                const cropped = raster.getSubRaster(bounds);
                cropped.remove();
                if (!this.remover) this.remover = new BackgroundRemover();
                const result = await this.remover.remove(cropped.canvas);
                if (this.request !== request) return;
                // Also catch in-progress brush strokes which haven't produced an undo snapshot yet.
                if (getRaster() !== raster || raster.canvas.toDataURL() !== original ||
                    getSelectedLeafItems().length) {
                    this.cancel();
                    return;
                }
                const offset = bounds.topLeft.subtract(raster.bounds.topLeft);
                raster.setImageData(result.getContext('2d').getImageData(0, 0, result.width, result.height),
                    new paper.Point(offset.x, offset.y));
                this.request = null;
                this.props.onUpdateImage();
                this.setState({busy: false});
            } catch (error) {
                if (this.request !== request) return;
                this.request = null;
                if (this.remover) this.remover.dispose();
                log.warn(error);
                this.setState({busy: false, error: true});
            }
        }, 0);
    }
    render () {
        return (
            <div className={styles.backgroundRemoval}>
                <FormattedMessage
                    {...(this.state.busy ? messages.cancel : messages.remove)}
                >
                    {label => (
                        <button
                            aria-label={label}
                            className={`${labeledIconStyles.modEditField} ${styles.backgroundRemovalButton}`}
                            data-busy={this.state.busy}
                            disabled={!this.state.busy && !this.props.bitmapRectangular}
                            title={label}
                            type="button"
                            onClick={this.state.busy ? this.handleCancel : this.handleRemove}
                        >
                            {this.state.busy ? <span
                                aria-hidden="true"
                                className={styles.backgroundRemovalWorking}
                            >
                                <span className={styles.backgroundRemovalSpinner} />
                                <img
                                    alt=""
                                    className={styles.backgroundRemovalCancel}
                                    draggable={false}
                                    src={closeIcon}
                                />
                            </span> : <img
                                alt=""
                                className={styles.backgroundRemovalIcon}
                                draggable={false}
                                src={removeBackgroundIcon}
                            />}
                            <span
                                className={`${labeledIconStyles.editFieldTitle} ${styles.backgroundRemovalLabel}`}
                            >
                                <span className={styles.backgroundRemovalIdleLabel}>
                                    <FormattedMessage {...messages.remove} />
                                </span>
                                <span className={styles.backgroundRemovalProgressLabel}>
                                    <FormattedMessage {...messages.removing} />
                                </span>
                                <span className={styles.backgroundRemovalCancelLabel}>
                                    <FormattedMessage {...messages.cancelLabel} />
                                </span>
                            </span>
                        </button>
                    )}
                </FormattedMessage>
                {this.state.error ? <span role="alert"><FormattedMessage
                    defaultMessage="Could not remove background. Please try again."
                    description="Background removal failed"
                    id="paint.backgroundRemoval.error"
                /></span> : null}
            </div>
        );
    }
}

RemoveBackground.propTypes = {
    bitmapRectangular: PropTypes.bool,
    changeMode: PropTypes.func.isRequired,
    imageId: PropTypes.string,
    mode: PropTypes.string,
    onUpdateImage: PropTypes.func.isRequired,
    undo: PropTypes.shape({pointer: PropTypes.number})
};

export {RemoveBackground};
export default connect(state => ({
    bitmapRectangular: state.scratchPaint.bitmapRectangular,
    mode: state.scratchPaint.mode,
    undo: state.scratchPaint.undo
}), {changeMode})(RemoveBackground);
