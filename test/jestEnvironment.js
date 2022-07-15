
jest.requireActual('core-js/actual/structured-clone'); // polyfill for structuredClone
// const smoothscroll = jest.requireActual('smoothscroll-polyfill')
// smoothscroll.polyfill();

Element.prototype.scrollTo = () => { return; };