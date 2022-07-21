jest.requireActual('core-js/actual/structured-clone'); // polyfill for structuredClone

Element.prototype.scrollTo = () => { return; };