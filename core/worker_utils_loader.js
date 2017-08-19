function handleInitialLoad(event) {
	self.removeEventListener('message', handleInitialLoad);
	eval(event.data.src);
}

self.addEventListener('message', handleInitialLoad);
