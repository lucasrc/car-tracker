export class KalmanFilter1D {
  private estimate: number;
  private errorCov: number;
  private processNoise: number;
  private measurementNoise: number;

  constructor(
    initialEstimate: number,
    processNoise: number,
    measurementNoise: number,
  ) {
    this.estimate = initialEstimate;
    this.errorCov = 1;
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  update(measurement: number): number {
    const predictedCov = this.errorCov + this.processNoise;
    const kalmanGain = predictedCov / (predictedCov + this.measurementNoise);
    this.estimate = this.estimate + kalmanGain * (measurement - this.estimate);
    this.errorCov = (1 - kalmanGain) * predictedCov;
    return this.estimate;
  }

  getEstimate(): number {
    return this.estimate;
  }

  reset(value: number): void {
    this.estimate = value;
    this.errorCov = 1;
  }

  setNoise(processNoise: number, measurementNoise: number): void {
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }
}
