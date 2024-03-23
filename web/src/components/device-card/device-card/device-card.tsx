import React from 'react';
import './device-card.css';
import AndroidIcon from '../../../assets/android-icon.svg';
import AppleIcon from '../../../assets/apple-icon.svg';
import LinkIcon from '../../../assets/link-icon.svg';
import { IDevice } from '../../../interfaces/IDevice';
import prettyMilliseconds from 'pretty-ms';
import DeviceFarmApiService from '../../../api-service';
import CancelGreenIcon from '../../../assets/cancel-green-icon.svg';
import CancelRedIcon from '../../../assets/cancel-red-icon.svg';

interface IDeviceCardProps {
  device: IDevice;
  reloadDevices: () => void;
}
export default class DeviceCard extends React.Component<IDeviceCardProps, any> {
  constructor(props: IDeviceCardProps) {
    super(props);
    this.state = {
      isLoading: false,
    };
  }
  getStatusClassName() {
    if (this.props.device.offline) {
      return 'disabled';
    } else if (this.props.device.busy) {
      return 'busy';
    } else {
      return '';
    }
  }

  getDeviceState() {
    if (this.props.device.offline) {
      return 'offline';
    } else if (this.props.device.busy) {
      return 'busy';
    } else {
      return 'ready';
    }
  }

  blockDevice(udid: string, host: string) {
    DeviceFarmApiService.blockDevice(udid, host);

    this.props.reloadDevices();
  }

  unblockDevice(udid: string, host: string) {
    DeviceFarmApiService.unblockDevice(udid, host);

    this.props.reloadDevices();
  }

  render() {
    const {
      name,
      sdk,
      deviceType,
      platform,
      udid,
      dashboard_link,
      total_session_count,
      host,
      totalUtilizationTimeMilliSec,
      userBlocked,
      busy,
      session_id,
    } = this.props.device;

    const deviceState = this.getDeviceState();
    const appiumHost = new URL(this.props.device.host).hostname;
    const appiumPort = new URL(this.props.device.host).port;
    let hostName = '';
    try {
      hostName = new URL(host).hostname;
    } catch (error) {
      hostName = host.split(':')[1].replace('//', '');
    }

    const handleLiveStreamClick = async () => {
      this.setState({ isLoading: true }); // Set loading state to true when the button is clicked

      const { udid, systemPort } = this.props.device;

      try {
        console.log('Live Stream');
        const sessionCreationResponse = await DeviceFarmApiService.createSession(udid, systemPort);
        const response = await DeviceFarmApiService.androidStreamingAppInstalled(udid, systemPort);
        console.log('Response:', response);
        if(sessionCreationResponse.status === 200) {
          console.log('Session created successfully');
        } else {
          console.error('Error creating session:', sessionCreationResponse);
        }
        if (response.status === 200) {
          window.location.href = `#/androidStream?port=${appiumPort}&host=${appiumHost}&udid=${udid}&width=${response.device.width}&height=${response.device.height}`;
        } else {
          alert('Please install the app to stream the device');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while trying to stream the device');
      } finally {
        this.setState({ isLoading: false }); // Set loading state back to false when the request is complete
      }
    };

    // const liveStreaming = () => {
    //   return (
    //     <div style={{ paddingLeft: '2px' }}>
    //       <button
    //         className="device-info-card__body_stream-device"
    //         onClick={async () => {
    //           console.log('Live Stream');
    //           const response = await DeviceFarmApiService.androidStreamingAppInstalled(udid, systemPort);
    //           if(response.status === 200) {
    //             (window.location.href = `#/androidStream?port=${appiumPort}&host=${appiumHost}&udid=${this.props.device.udid}`)
    //           } else {
    //            alert('Please install the app to stream the device');
    //         }
    //         }
    //         }
    //       >
    //         Live Stream
    //       </button>
    //     </div>
    //   );
    // };
    const blockButton = () => {
      if (busy) {
        return;
      }
      if (!userBlocked) {
        return (
          <button
            className="device-info-card__body_block-device"
            onClick={() => this.blockDevice(udid, host)}
          >
            <img src={CancelGreenIcon} className="device-info-card__body_block-device-icon" />
            Block Device
          </button>
        );
      } else {
        return (
          <button
            className="device-info-card__body_unblock-device"
            onClick={() => this.unblockDevice(udid, host)}
          >
            <img src={CancelRedIcon} className="device-info-card__body_block-device-icon" />
            Unblock Device
          </button>
        );
      }
    };

    return (
      <div className={`device-info-card-container ${this.getStatusClassName()}`}>
        <div className={`device-state ${deviceState}`}>{deviceState}</div>
        <div className="device-info-card-container__title_wrapper">
          <div className="code device-info-card-container__device-title" title={udid}>
            {udid}
          </div>
          {['ios', 'tvos'].includes(platform) ? (
            <img src={AppleIcon} className="device-info-card-container__device-icon" />
          ) : (
            <img src={AndroidIcon} className="device-info-card-container__device-icon" />
          )}
        </div>
        <div className="device-info-card-container__body">
          <div className="device-info-card-container__body_row">
            <div className="device-info-card-container__body_row_label">Version:</div>
            <div className="device-info-card-container__body_row_value" title={sdk}>
              {sdk}
            </div>
          </div>
          <div className="device-info-card-container__body_row">
            <div className="device-info-card-container__body_row_label">Name:</div>
            <div className="device-info-card-container__body_row_value" title={name}>
              {name}
            </div>
          </div>
          <div className="device-info-card-container__body_row">
            <div className="device-info-card-container__body_row_label">Device Type:</div>
            <div className="device-info-card-container__body_row_value" title={deviceType}>
              {deviceType}
            </div>
          </div>
          <div className="device-info-card-container__body_row">
            <div className="device-info-card-container__body_row_label">Device Location:</div>
            <div className="device-info-card-container__body_row_value" title={hostName}>
              {hostName}
            </div>
          </div>
          {totalUtilizationTimeMilliSec != null && (
            <div className="device-info-card-container__body_row">
              <div className="device-info-card-container__body_row_label">Utilization:</div>
              <div
                className="device-info-card-container__body_row_value"
                title={prettyMilliseconds(totalUtilizationTimeMilliSec)}
              >
                {prettyMilliseconds(totalUtilizationTimeMilliSec)}
              </div>
            </div>
          )}
          {session_id != null && (
            <div className="device-info-card-container__body_row">
              <div className="device-info-card-container__body_row_label">Session ID:</div>
              <div
                className="device-info-card-container__body_row_value"
                title={session_id.toString()}
              >
                {session_id}
              </div>
            </div>
          )}
          {dashboard_link && !!total_session_count && total_session_count > 0 && (
            <div className="dashboard-link-wrapper">
              <div>
                <div className="device-info-card-container__body_row_label">
                  {`Session${total_session_count > 1 ? 's' : ''}:`}
                </div>
              </div>
              <div className="dashboard-link">
                <img src={LinkIcon} className="link-icon" />
                <a className="footer-deeplink" href={dashboard_link} target="_blank">
                  Appium Dashboard ({total_session_count})
                </a>
              </div>
            </div>
          )}
        </div>
        <div className="device-info-card-container__footer_wrapper">
          {blockButton()}
          <div style={{ paddingLeft: '2px' }}>
            <button
              className="device-info-card__body_stream-device"
              onClick={handleLiveStreamClick}
              disabled={this.state.isLoading}
            >
              {this.state.isLoading ? 'Brewing...' : 'Live Stream'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
