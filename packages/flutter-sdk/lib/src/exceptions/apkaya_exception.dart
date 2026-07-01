class ApkayaException implements Exception {
  ApkayaException(this.statusCode, this.message);
  final int statusCode;
  final String message;

  @override
  String toString() => 'ApkayaException($statusCode): $message';
}
