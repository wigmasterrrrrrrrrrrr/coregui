import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import {defineMessages, intlShape, injectIntl} from 'react-intl';
import VM from 'scratch-vm';

import PaintEditorWrapper from '../containers/paint-editor-wrapper.jsx';
import {connect} from 'react-redux';
import errorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import {handleFileUpload, costumeUpload} from '../lib/file-uploader.js';
import {emptyCostume} from '../lib/empty-assets';
import sharedMessages from '../lib/shared-messages';
import downloadBlob from '../lib/download-blob';
import {setRestore} from '../reducers/restore-deletion';
import {showStandardAlert, closeAlertWithId} from '../reducers/alerts';
import {
    openCostumeLibrary,
    openBackdropLibrary
} from '../reducers/modals';

import {getCostumeLibrary, getBackdropLibrary} from '../lib/libraries/tw-async-libraries';

import styles from './animation-editor.css';

let messages = defineMessages({
    addLibraryBackdropMsg: {
        defaultMessage: 'Choose a Backdrop',
        description: 'Button to add a backdrop in the editor tab',
        id: 'gui.costumeTab.addBackdropFromLibrary'
    },
    addLibraryCostumeMsg: {
        defaultMessage: 'Choose a Costume',
        description: 'Button to add a costume in the editor tab',
        id: 'gui.costumeTab.addCostumeFromLibrary'
    },
    addBlankCostumeMsg: {
        defaultMessage: 'Paint',
        description: 'Button to add a blank costume in the editor tab',
        id: 'gui.costumeTab.addBlankCostume'
    },
    addSurpriseCostumeMsg: {
        defaultMessage: 'Surprise',
        description: 'Button to add a surprise costume in the editor tab',
        id: 'gui.costumeTab.addSurpriseCostume'
    },
    addFileBackdropMsg: {
        defaultMessage: 'Upload Backdrop',
        description: 'Button to add a backdrop by uploading a file in the editor tab',
        id: 'gui.costumeTab.addFileBackdrop'
    },
    addFileCostumeMsg: {
        defaultMessage: 'Upload Costume',
        description: 'Button to add a costume by uploading a file in the editor tab',
        id: 'gui.costumeTab.addFileCostume'
    },
    onionSkin: {
        defaultMessage: 'Onion Skin',
        description: 'Toggle for onion skinning in animation editor',
        id: 'gui.animationEditor.onionSkin'
    }
});

messages = {...messages, ...sharedMessages};

class AnimationEditor extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleSelectFrame',
            'handleDeleteFrame',
            'handleDuplicateFrame',
            'handleExportFrame',
            'handleNewFrame',
            'handleNewBlankFrame',
            'handleSurpriseFrame',
            'handleSurpriseBackdrop',
            'handleFileUploadClick',
            'handleFrameUpload',
            'handlePlay',
            'handleStop',
            'handleStepForward',
            'handleStepBackward',
            'handleFpsChange',
            'handleToggleOnionSkin',
            'setFileInput',
            'getThumbnailUrl'
        ]);

        const {
            editingTarget,
            sprites,
            stage
        } = props;
        const target = editingTarget && sprites[editingTarget] ? sprites[editingTarget] : stage;
        if (target && target.currentCostume) {
            this.state = {
                selectedFrameIndex: target.currentCostume,
                playing: false,
                fps: 12,
                onionSkin: false
            };
        } else {
            this.state = {
                selectedFrameIndex: 0,
                playing: false,
                fps: 12,
                onionSkin: false
            };
        }
        this.playInterval = null;
        this.timelineRef = React.createRef();
    }
    componentWillReceiveProps (nextProps) {
        const {
            editingTarget,
            sprites,
            stage
        } = nextProps;

        const target = editingTarget && sprites[editingTarget] ? sprites[editingTarget] : stage;
        if (!target || !target.costumes) {
            return;
        }

        if (this.props.editingTarget === editingTarget) {
            const oldTarget = this.props.sprites[editingTarget] ?
                this.props.sprites[editingTarget] : this.props.stage;
            if (oldTarget.costumeCount !== target.costumeCount) {
                this.setState({selectedFrameIndex: target.currentCostume});
            }
        } else {
            this.setState({selectedFrameIndex: target.currentCostume});
        }
    }
    componentWillUnmount () {
        this.handleStop();
    }
    getThumbnailUrl (costume) {
        if (!costume || !costume.asset) return null;
        const ext = costume.dataFormat;
        if (ext === 'svg') {
            return costume.asset.encodeDataURI();
        }
        return costume.asset.encodeDataURI();
    }
    handleSelectFrame (index) {
        this.props.vm.editingTarget.setCostume(index);
        this.setState({selectedFrameIndex: index});
    }
    handleDeleteFrame (index) {
        const restoreCostumeFun = this.props.vm.deleteCostume(index);
        this.props.dispatchUpdateRestore({
            restoreFun: restoreCostumeFun,
            deletedItem: 'Costume'
        });
    }
    handleDuplicateFrame (index) {
        this.props.vm.duplicateCostume(index);
    }
    handleExportFrame (index) {
        const item = this.props.vm.editingTarget.sprite.costumes[index];
        const blob = new Blob([
            this.props.vm.getExportedCostume(item)
        ], {type: item.asset.assetType.contentType});
        downloadBlob(`${item.name}.${item.asset.dataFormat}`, blob);
    }
    handleNewFrame (costume, fromLibrary, targetId) {
        const costumes = Array.isArray(costume) ? costume : [costume];
        return Promise.all(costumes.map(c => {
            if (fromLibrary) {
                return this.props.vm.addCostumeFromLibrary(c.md5, c);
            }
            return this.props.vm.addCostume(c.md5, c, targetId);
        }));
    }
    handleNewBlankFrame () {
        const name = this.props.vm.editingTarget.isStage ?
            this.props.intl.formatMessage(messages.backdrop, {index: 1}) :
            this.props.intl.formatMessage(messages.costume, {index: 1});
        this.handleNewFrame(emptyCostume(name));
    }
    async handleSurpriseFrame () {
        const costumeLibraryContent = await getCostumeLibrary();
        const item = costumeLibraryContent[Math.floor(Math.random() * costumeLibraryContent.length)];
        const vmCostume = {
            name: item.name,
            md5: item.md5ext,
            rotationCenterX: item.rotationCenterX,
            rotationCenterY: item.rotationCenterY,
            bitmapResolution: item.bitmapResolution,
            skinId: null
        };
        this.handleNewFrame(vmCostume, true);
    }
    async handleSurpriseBackdrop () {
        const backdropLibraryContent = await getBackdropLibrary();
        const item = backdropLibraryContent[Math.floor(Math.random() * backdropLibraryContent.length)];
        const vmCostume = {
            name: item.name,
            md5: item.md5ext,
            rotationCenterX: item.rotationCenterX,
            rotationCenterY: item.rotationCenterY,
            bitmapResolution: item.bitmapResolution,
            skinId: null
        };
        this.handleNewFrame(vmCostume);
    }
    handleFrameUpload (e) {
        const vm = this.props.vm;
        const targetId = this.props.vm.editingTarget.id;
        this.props.onShowImporting();
        handleFileUpload(e.target, (buffer, fileType, fileName, fileIndex, fileCount) => {
            costumeUpload(buffer, fileType, vm, vmCostumes => {
                vmCostumes.forEach((costume, i) => {
                    costume.name = `${fileName}${i ? i + 1 : ''}`;
                });
                this.handleNewFrame(vmCostumes, false, targetId).then(() => {
                    if (fileIndex === fileCount - 1) {
                        this.props.onCloseImporting();
                    }
                });
            }, this.props.onCloseImporting);
        }, this.props.onCloseImporting);
    }
    handleFileUploadClick () {
        this.fileInput.click();
    }
    setFileInput (input) {
        this.fileInput = input;
    }
    handlePlay () {
        if (this.state.playing) {
            this.handleStop();
        } else {
            this.setState({playing: true});
            const interval = 1000 / this.state.fps;
            this.playInterval = setInterval(() => {
                const target = this.props.vm.editingTarget;
                if (!target || !target.sprite) return;
                const costumes = target.sprite.costumes;
                const nextIndex = (this.state.selectedFrameIndex + 1) % costumes.length;
                this.handleSelectFrame(nextIndex);
                this.scrollTimelineToFrame(nextIndex);
            }, interval);
        }
    }
    handleStop () {
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this.setState({playing: false});
    }
    handleStepForward () {
        this.handleStop();
        const target = this.props.vm.editingTarget;
        if (!target || !target.sprite) return;
        const costumes = target.sprite.costumes;
        const nextIndex = (this.state.selectedFrameIndex + 1) % costumes.length;
        this.handleSelectFrame(nextIndex);
        this.scrollTimelineToFrame(nextIndex);
    }
    handleStepBackward () {
        this.handleStop();
        const target = this.props.vm.editingTarget;
        if (!target || !target.sprite) return;
        const costumes = target.sprite.costumes;
        const prevIndex = (this.state.selectedFrameIndex - 1 + costumes.length) % costumes.length;
        this.handleSelectFrame(prevIndex);
        this.scrollTimelineToFrame(prevIndex);
    }
    handleFpsChange (e) {
        const fps = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 12));
        this.setState({fps});
        if (this.state.playing) {
            this.handleStop();
            this.setState({playing: true}, () => {
                const interval = 1000 / fps;
                this.playInterval = setInterval(() => {
                    const target = this.props.vm.editingTarget;
                    if (!target || !target.sprite) return;
                    const costumes = target.sprite.costumes;
                    const nextIndex = (this.state.selectedFrameIndex + 1) % costumes.length;
                    this.handleSelectFrame(nextIndex);
                    this.scrollTimelineToFrame(nextIndex);
                }, interval);
            });
        }
    }
    handleToggleOnionSkin () {
        this.setState(prev => ({onionSkin: !prev.onionSkin}));
    }
    scrollTimelineToFrame (index) {
        if (this.timelineRef.current) {
            const frameEl = this.timelineRef.current.children[index];
            if (frameEl) {
                frameEl.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
            }
        }
    }
    render () {
        const {
            intl,
            isRtl,
            onNewLibraryBackdropClick,
            onNewLibraryCostumeClick,
            vm
        } = this.props;

        if (!vm.editingTarget) {
            return null;
        }

        const isStage = vm.editingTarget.isStage;
        const target = vm.editingTarget.sprite;
        const costumes = target.costumes || [];
        const {selectedFrameIndex, playing, fps, onionSkin} = this.state;

        const libraryMsg = isStage ? messages.addLibraryBackdropMsg : messages.addLibraryCostumeMsg;
        const libraryFunc = isStage ? onNewLibraryBackdropClick : onNewLibraryCostumeClick;

        return (
            <div className={styles.wrapper}>
                <div className={styles.canvasArea}>
                    {costumes.length > 0 ?
                        <PaintEditorWrapper
                            selectedCostumeIndex={selectedFrameIndex}
                        /> :
                        null
                    }
                    {onionSkin && costumes.length > 1 && selectedFrameIndex > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            pointerEvents: 'none',
                            opacity: 0.25,
                            mixBlendMode: 'multiply'
                        }}>
                            <img
                                src={this.getThumbnailUrl(costumes[selectedFrameIndex - 1])}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain'
                                }}
                            />
                        </div>
                    )}
                </div>

                <div className={styles.timelineBar}>
                    <div className={styles.controlsRow}>
                        <div className={styles.controlGroup}>
                            <button
                                className={`${styles.playBtn} ${playing ? styles.active : ''}`}
                                onClick={this.handlePlay}
                                title={playing ? 'Pause' : 'Play'}
                            >
                                {playing ? '\u23F8' : '\u25B6'}
                            </button>
                            <button
                                className={styles.stepBtn}
                                onClick={this.handleStepBackward}
                                title="Previous Frame"
                            >
                                {'\u23EE'}
                            </button>
                            <button
                                className={styles.stepBtn}
                                onClick={this.handleStepForward}
                                title="Next Frame"
                            >
                                {'\u23ED'}
                            </button>
                        </div>

                        <div className={styles.controlDivider} />

                        <div className={styles.fpsControl}>
                            <span>FPS</span>
                            <input
                                className={styles.fpsInput}
                                type="number"
                                min="1"
                                max="60"
                                value={fps}
                                onChange={this.handleFpsChange}
                            />
                        </div>

                        <div className={styles.controlDivider} />

                        <button
                            className={`${styles.onionBtn} ${onionSkin ? styles.active : ''}`}
                            onClick={this.handleToggleOnionSkin}
                        >
                            {intl.formatMessage(messages.onionSkin)}
                        </button>

                        <div className={styles.controlDivider} />

                        <div className={styles.controlGroup}>
                            <button
                                className={styles.frameActionBtn}
                                onClick={libraryFunc}
                                title={intl.formatMessage(libraryMsg)}
                            >
                                {'\u{1F4E6}'}
                            </button>
                            <button
                                className={styles.frameActionBtn}
                                onClick={this.handleFileUploadClick}
                                title="Upload Frame"
                            >
                                {'\u2B06'}
                            </button>
                            <button
                                className={styles.frameActionBtn}
                                onClick={this.handleNewBlankFrame}
                                title="New Blank Frame"
                            >
                                {'\u2795'}
                            </button>
                            <button
                                className={styles.frameActionBtn}
                                onClick={() => this.handleDuplicateFrame(selectedFrameIndex)}
                                title="Duplicate Frame"
                            >
                                {'\u2398'}
                            </button>
                            <button
                                className={`${styles.frameActionBtn} ${styles.danger}`}
                                onClick={() => this.handleDeleteFrame(selectedFrameIndex)}
                                title="Delete Frame"
                                disabled={costumes.length <= 1}
                            >
                                {'\u2716'}
                            </button>
                            <button
                                className={styles.frameActionBtn}
                                onClick={() => this.handleExportFrame(selectedFrameIndex)}
                                title="Export Frame"
                            >
                                {'\u2B07'}
                            </button>
                        </div>

                        <span className={styles.frameCounter}>
                            {selectedFrameIndex + 1} / {costumes.length}
                        </span>
                    </div>

                    <div
                        className={styles.timelineStrip}
                        ref={this.timelineRef}
                    >
                        {costumes.map((costume, index) => {
                            const thumbUrl = this.getThumbnailUrl(costume);
                            return (
                                <div
                                    key={costume.name + index}
                                    className={`${styles.frameThumb} ${
                                        index === selectedFrameIndex ? styles.selected : ''
                                    }`}
                                    onClick={() => this.handleSelectFrame(index)}
                                >
                                    {thumbUrl ? (
                                        <img src={thumbUrl} alt={costume.name} />
                                    ) : (
                                        <span style={{fontSize: '0.5rem', color: '#999'}}>
                                            {costume.name}
                                        </span>
                                    )}
                                    <div className={styles.frameNumber}>
                                        {index + 1}
                                    </div>
                                </div>
                            );
                        })}
                        <button
                            className={styles.frameAdd}
                            onClick={this.handleNewBlankFrame}
                            title="Add Frame"
                        >
                            +
                        </button>
                    </div>

                    <input
                        ref={this.setFileInput}
                        type="file"
                        accept=".svg, .png, .bmp, .jpg, .jpeg, .jfif, .webp, .gif"
                        multiple
                        style={{display: 'none'}}
                        onChange={this.handleFrameUpload}
                    />
                </div>
            </div>
        );
    }
}

AnimationEditor.propTypes = {
    dispatchUpdateRestore: PropTypes.func,
    editingTarget: PropTypes.string,
    intl: intlShape,
    isRtl: PropTypes.bool,
    onCloseImporting: PropTypes.func.isRequired,
    onNewLibraryBackdropClick: PropTypes.func.isRequired,
    onNewLibraryCostumeClick: PropTypes.func.isRequired,
    onShowImporting: PropTypes.func.isRequired,
    sprites: PropTypes.shape({
        id: PropTypes.shape({
            costumes: PropTypes.arrayOf(PropTypes.shape({
                url: PropTypes.string,
                name: PropTypes.string.isRequired,
                skinId: PropTypes.number
            }))
        })
    }),
    stage: PropTypes.shape({
        sounds: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string.isRequired
        }))
    }),
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    editingTarget: state.scratchGui.targets.editingTarget,
    isRtl: state.locales.isRtl,
    sprites: state.scratchGui.targets.sprites,
    stage: state.scratchGui.targets.stage,
    dragging: state.scratchGui.assetDrag.dragging
});

const mapDispatchToProps = dispatch => ({
    onNewLibraryBackdropClick: e => {
        e.preventDefault();
        dispatch(openBackdropLibrary());
    },
    onNewLibraryCostumeClick: e => {
        e.preventDefault();
        dispatch(openCostumeLibrary());
    },
    dispatchUpdateRestore: restoreState => {
        dispatch(setRestore(restoreState));
    },
    onCloseImporting: () => dispatch(closeAlertWithId('importingAsset')),
    onShowImporting: () => dispatch(showStandardAlert('importingAsset'))
});

export default errorBoundaryHOC('Animation Editor')(
    injectIntl(connect(
        mapStateToProps,
        mapDispatchToProps
    )(AnimationEditor))
);
