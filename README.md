# Solana Place Pixel Embedder

A Chrome extension that automates pixel art embedding on Solana Place with advanced features including resume capabilities, image validation, and comprehensive progress tracking.

![Extension Icon](icons/icon128.png)

## Features

### 🎨 **Smart Image Embedding**
- Upload PNG, JPG, or JPEG images and automatically convert them to pixel art
- Intelligent image scaling with customizable max width (10-500px)
- Position control with X/Y coordinates or auto-centering
- Real-time pixel count estimation and time calculation

### ⚡ **Optimized Performance**
- **150 pixels per minute** safe placement rate
- Intelligent burst protection and rate limiting
- Universal 400ms delays for maximum safety across all account tiers
- Automatic credit detection and insufficient credit warnings

### 🔄 **Session Management**
- **Auto-save progress** - never lose your work
- Resume interrupted embeddings from where you left off
- Session validation to recover missing pixels
- 24-hour session persistence with automatic cleanup

### 📊 **Advanced Monitoring**
- Real-time progress tracking with visual progress bar
- Live statistics: pixels placed, errors, rate, credits remaining
- Comprehensive embedding history with completion rates
- Connection status monitoring across multiple tabs

### 🛡️ **Safety Features**
- Burst limit protection (15 pixels per 10-second window)
- Rate limit detection and automatic recovery
- Credit monitoring with insufficient credit warnings
- Error handling and automatic retry mechanisms

## Installation

### Option 1: Manual Installation (Recommended)

1. **Download the Extension**
   - Download all the extension files to a folder on your computer
   - Ensure you have these files:
     ```
     manifest.json
     background.js
     content.js
     injected.js
     popup.html
     popup.css
     popup.js
     icons/ (folder with icon files)
     ```

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" on (top right corner)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should appear in your extensions list

4. **Pin the Extension**
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "Solana Place Pixel Embedder" and click the pin icon
   - The extension icon will now appear in your toolbar

### Option 2: Build from Source

If you want to modify the extension:

1. Clone or download the source files
2. Make your modifications
3. Follow the manual installation steps above

## Usage

### Getting Started

1. **Navigate to Solana Place**
   - Go to [solanaplace.fun](https://solanaplace.fun)
   - Connect your wallet and ensure you have credits
   - The extension icon will turn green when connected

2. **Open the Extension**
   - Click the extension icon in your toolbar
   - You should see "Connected" status in the header

### Embedding an Image

1. **Upload Image**
   - Click "Click to select image" or drag and drop
   - Supported formats: PNG, JPG, JPEG
   - Preview will show with dimensions

2. **Set Position**
   - Enter X/Y coordinates (0-2999 for X, 0-1999 for Y)
   - Set max width (10-500 pixels)
   - Use "Center" button for automatic centering

3. **Review Estimation**
   - Check pixel count and estimated time
   - Verify you have sufficient credits
   - Review any warnings about insufficient credits

4. **Start Embedding**
   - Click "Start Embedding"
   - Progress will be tracked in real-time
   - You can switch tabs or close the popup - progress continues

### Resuming Interrupted Sessions

1. **Check for Sessions**
   - Go to the "Resume" tab
   - Any incomplete sessions will be shown

2. **Choose Resume Mode**
   - **Continue Only**: Resume with remaining pixels
   - **Validate & Recover**: Check for missing pixels (recommended)

3. **Resume**
   - Click "Resume Session"
   - Progress tracking will resume automatically

### Validating Completed Images

1. **Go to Validate Tab**
   - Must have a saved session with original image data
   - Click "Validate Image"

2. **Recovery Process**
   - Extension checks every pixel of your original image
   - Automatically places any missing pixels
   - Shows completion message when finished

### Viewing History

1. **History Tab**
   - View all past embedding sessions
   - See completion rates, duration, and statistics
   - Use "Use Coords" to reuse positioning from past embeddings

## Technical Details

### Performance Specifications
- **Rate**: 150 pixels per minute (400ms base delay + safety buffer)
- **Burst Protection**: Maximum 15 pixels per 10-second window
- **Safety Delays**: 400ms universal delay + 50-150ms random safety buffer
- **Region Checking**: Batched API calls for existing pixel validation

### Architecture
- **Background Script**: Handles installation, settings, notifications
- **Content Script**: Communication bridge between popup and page
- **Injected Script**: Runs in page context for direct socket access
- **Popup Interface**: Multi-tab UI for control and monitoring

### Storage
- **Session Data**: Stored in localStorage (24-hour persistence)
- **History**: Chrome storage.local (last 50 embeddings)
- **Settings**: Chrome storage.sync (cross-device synchronization)

### Browser Compatibility
- **Chrome**: Full support (Manifest V3)
- **Edge**: Should work (Chromium-based)
- **Firefox**: Not supported (different manifest format)

## Safety and Rate Limiting

### Rate Limit Compliance
- Designed for **all account tiers** (Free, Premium, VIP)
- Conservative 400ms delays ensure compliance
- Automatic burst protection prevents violations
- Real-time rate limit detection and recovery

### Credit Management
- Real-time credit monitoring
- Insufficient credit warnings before starting
- Option to proceed with incomplete embeddings
- Credit usage tracking in history

### Error Handling
- Automatic retry on transient errors
- Extended cooldowns on rate limit hits
- Session persistence during interruptions
- Graceful handling of connection issues

## Troubleshooting

### Common Issues

**Extension not connecting:**
- Refresh the Solana Place page
- Check that you're logged in and have credits
- Try opening/closing the extension popup

**Embedding not starting:**
- Verify you're on solanaplace.fun
- Check browser console for errors
- Ensure sufficient credits or choose to proceed anyway

**Progress not tracking:**
- Make sure the Solana Place tab stays open
- Check that the extension has proper permissions
- Try refreshing the page and restarting

**Session not resuming:**
- Check if session is older than 24 hours (auto-expired)
- Verify you're on the correct Solana Place tab
- Try clearing the session and starting fresh

### Debug Information

Enable debug logging by opening browser console (F12) while using the extension. Look for messages prefixed with:
- `🚀` - Initialization
- `✅` - Success operations  
- `❌` - Errors
- `🔄` - Progress updates
- `💾` - Storage operations

## Privacy and Security

- **No Data Collection**: Extension doesn't collect or transmit personal data
- **Local Storage Only**: All data stored locally in your browser
- **No External Servers**: Communicates only with Solana Place directly
- **Open Source**: Code can be reviewed for security

## Support

### Getting Help
- Check the troubleshooting section above
- Review browser console for error messages
- Ensure you're using the latest version

### Known Limitations
- Only works on solanaplace.fun domain
- Requires manual socket connection establishment
- Chrome/Chromium browsers only
- Maximum 24-hour session persistence

## License

This extension is provided as-is for educational and personal use. Use responsibly and in accordance with Solana Place's terms of service.

## Version History

### v1.0.0
- Initial release
- Multi-tab interface (Embed, Resume, Validate, History)
- Session persistence and resume capabilities
- Real-time progress tracking
- Comprehensive rate limiting and safety features
- Image validation and recovery
- Embedding history with statistics

---

**⚠️ Important**: Always use this extension responsibly and in accordance with Solana Place's terms of service. The extension implements conservative rate limiting to ensure fair usage, but ultimate responsibility lies with the user.