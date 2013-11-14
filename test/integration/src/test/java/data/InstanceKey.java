package data;

public class InstanceKey {
	private String key;
	private String value;

	public InstanceKey(String key, String value) {
		this.key = key;
		this.value = value;
	}

	public String toString() {
		return ("Key: " + key + " Value: " + value);
	}

	public String getKey() {
		return key;
	}

	public String getValue() {
		return value;
	}
}
