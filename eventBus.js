// 简单的事件总线实现
export const eventBus = {
    events: {},
    
    on(eventName, fn) {
        this.events[eventName] = this.events[eventName] || [];
        this.events[eventName].push(fn);
    },
    
    off(eventName, fn) {
        if (this.events[eventName]) {
            if (fn) {
                this.events[eventName] = this.events[eventName].filter(f => f !== fn);
            } else {
                delete this.events[eventName];
            }
        }
    },
    
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(fn => fn(data));
        }
    }
};
