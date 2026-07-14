import React from 'react';

let realScratchPaint;
const getRealScratchPaint = () => {
    if (!realScratchPaint) {
        realScratchPaint = require('scratch-paint');
    }
    return realScratchPaint;
};

const PaintEditor = props => React.createElement(getRealScratchPaint().default, props);

let hasSetupReducer = true;
const ScratchPaintReducer = (state, action) => {
    if (!hasSetupReducer && action.type === 'scratch-gui/navigation/ACTIVATE_TAB' && action.activeTabIndex === 0) {
        hasSetupReducer = true;
    }
    if (hasSetupReducer) {
        return getRealScratchPaint().ScratchPaintReducer(state, action);
    }
    return {};
};

export {
    PaintEditor as default,
    ScratchPaintReducer
};
