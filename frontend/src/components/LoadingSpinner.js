import React from 'react';
import './LoadingSpinner.css';

/**
 * LoadingSpinner Component
 *
 * A versatile loading component with different variants and states
 *
 * Props:
 * - variant: 'spinner' | 'skeleton' | 'dots' | 'pulse' | 'progress'
 * - size: 'small' | 'medium' | 'large'
 * - message: Optional loading message
 * - progress: Progress percentage for progress variant (0-100)
 * - overlay: Whether to show as overlay
 * - centered: Whether to center in container
 */

const LoadingSpinner = ({
  variant = 'spinner',
  size = 'medium',
  message = '',
  progress = 0,
  overlay = false,
  centered = true,
  className = ''
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'loading--small';
      case 'large': return 'loading--large';
      default: return 'loading--medium';
    }
  };

  const renderVariant = () => {
    switch (variant) {
      case 'skeleton':
        return <SkeletonLoader />;
      case 'dots':
        return <DotsLoader />;
      case 'pulse':
        return <PulseLoader />;
      case 'progress':
        return <ProgressBar progress={progress} />;
      default:
        return <Spinner />;
    }
  };

  const classes = [
    'loading',
    getSizeClass(),
    overlay && 'loading--overlay',
    centered && 'loading--centered',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {renderVariant()}
      {message && (
        <div className="loading__message">
          {message}
        </div>
      )}
    </div>
  );
};

// Spinner variant - classic rotating circle
const Spinner = () => (
  <div className="spinner">
    <div className="spinner__circle"></div>
    <div className="spinner__circle"></div>
    <div className="spinner__circle"></div>
    <div className="spinner__circle"></div>
  </div>
);

// Dots loader - bouncing dots
const DotsLoader = () => (
  <div className="dots-loader">
    <div className="dots-loader__dot"></div>
    <div className="dots-loader__dot"></div>
    <div className="dots-loader__dot"></div>
  </div>
);

// Pulse loader - pulsing circles
const PulseLoader = () => (
  <div className="pulse-loader">
    <div className="pulse-loader__circle"></div>
    <div className="pulse-loader__circle"></div>
    <div className="pulse-loader__circle"></div>
  </div>
);

// Progress bar
const ProgressBar = ({ progress }) => (
  <div className="progress-bar">
    <div className="progress-bar__track">
      <div
        className="progress-bar__fill"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      ></div>
    </div>
    <div className="progress-bar__text">{progress}%</div>
  </div>
);

// Skeleton loader - placeholder content
const SkeletonLoader = () => (
  <div className="skeleton-loader">
    <div className="skeleton-loader__item skeleton__header"></div>
    <div className="skeleton-loader__item skeleton__line"></div>
    <div className="skeleton-loader__item skeleton__line skeleton__short"></div>
    <div className="skeleton-loader__item skeleton__line"></div>
    <div className="skeleton-loader__item skeleton__button"></div>
  </div>
);

// Predefined loading configurations for common use cases
export const FlightSearchLoader = ({ message = "Searching flights..." }) => (
  <LoadingSpinner
    variant="dots"
    size="large"
    message={message}
    className="flight-search-loader"
  />
);

export const SeatMapLoader = ({ message = "Loading seat map..." }) => (
  <LoadingSpinner
    variant="spinner"
    size="medium"
    message={message}
    className="seat-map-loader"
  />
);

export const BookingLoader = ({ progress, message }) => (
  <LoadingSpinner
    variant="progress"
    size="medium"
    message={message || "Processing booking..."}
    progress={progress}
    className="booking-loader"
  />
);

export const PageLoader = ({ message = "Loading..." }) => (
  <LoadingSpinner
    variant="pulse"
    size="large"
    message={message}
    overlay={true}
    className="page-loader"
  />
);

export const ContentLoader = () => (
  <LoadingSpinner
    variant="skeleton"
    size="medium"
    className="content-loader"
  />
);

export default LoadingSpinner;