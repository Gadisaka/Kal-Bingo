// NumberCounter.js
export class NumberCounter {
  constructor(socket, roomId) {
    this.count = 0;
    this.numbers = [];
    this.onUpdate = null;
    this.socket = socket;
    this.roomId = roomId;
    this.listener = ({ roomId: r, calledNumbersCount, numbersList }) => {
      if (r === roomId) {
        this.count = calledNumbersCount;
        this.numbers = numbersList || [];
        if (this.onUpdate) {
          this.onUpdate(this.count, this.numbers);
        }
      }
    };
    socket.on("calledNumbersUpdate", this.listener);
  }
  setOnUpdate(fn) {
    this.onUpdate = fn;
  }
  cleanup() {
    this.socket.off("calledNumbersUpdate", this.listener);
  }
}
