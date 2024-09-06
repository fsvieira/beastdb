/*
Custom Record Exceptions
*/
class RecordUpdateConflictException extends Error {
    constructor(message) {
        super(message);  // Pass the message to the base Error class
        this.name = this.constructor.name;  // Ensure the error has a unique name
    }
}


module.exports = {
    RecordUpdateConflictException
}