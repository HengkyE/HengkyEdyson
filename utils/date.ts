/**
 * Date formatting utilities for Indonesian locale
 */

/**
 * Format date to Indonesian format
 * @param date - Date object or ISO string
 * @returns Formatted date string (e.g., "Selasa, 30 Desember 2025")
 */
export function formatDateIndo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  const dayName = days[dateObj.getDay()];
  const day = dateObj.getDate();
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  
  return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Format date and time to Indonesian format
 * @param date - Date object or ISO string
 * @returns Formatted date and time string
 */
export function formatDateTimeIndo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formattedDate = formatDateIndo(dateObj);
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  
  return `${formattedDate}, ${hours}:${minutes}`;
}

/**
 * Get current date in Indonesian format
 * @returns Current date formatted in Indonesian
 */
export function getCurrentDateIndo(): string {
  return formatDateIndo(new Date());
}

/**
 * Get current date and time in Indonesian format
 * @returns Current date and time formatted in Indonesian
 */
export function getCurrentDateTimeIndo(): string {
  return formatDateTimeIndo(new Date());
}

/**
 * Format date to Indonesian format for receipts (compact format)
 * @param date - Date object or ISO string
 * @returns Formatted date string (e.g., "30 Des 2025, 14:30")
 */
export function formatDateID(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  
  const day = dateObj.getDate();
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

