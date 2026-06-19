import ReactDOM from 'react-dom';
import {setAppElement} from 'react-modal';

const appTarget = document.getElementById('app');

// Remove everything from the target to fix macOS Safari "Save Page As",
while (appTarget.firstChild) {
    appTarget.removeChild(appTarget.firstChild);
}

setAppElement(appTarget);

const render = children => {
    appTarget.style.opacity = '0';
    appTarget.style.transform = 'translateY(12px)';
    appTarget.style.transition = 'opacity 0.35s ease, transform 0.35s ease';

    ReactDOM.render(children, appTarget);

    if (window.SplashEnd) {
        window.SplashEnd();
    }

    requestAnimationFrame(() => {
        appTarget.style.opacity = '1';
        appTarget.style.transform = 'translateY(0)';
    });
};

export default render;
