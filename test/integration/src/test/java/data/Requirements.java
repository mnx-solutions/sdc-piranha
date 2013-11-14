package data;

public class Requirements {
	private String min_memory;
	private String min_ram;
	private String max_memory;
	private String max_ram;

	@Override
	public String toString() {
		return "Requirements [min_memory=" + min_memory + ", min_ram="
				+ min_ram + ", max_memory=" + max_memory + ", max_ram="
				+ max_ram + "]";
	}

	public Requirements(String min_memory, String min_ram, String max_memory,
			String max_ram) {
		super();
		this.min_memory = min_memory;
		this.min_ram = min_ram;
		this.max_memory = max_memory;
		this.max_ram = max_ram;
	}

	public String getMin_memory() {
		return min_memory;
	}

	public void setMin_memory(String min_memory) {
		this.min_memory = min_memory;
	}

	public String getMin_ram() {
		return min_ram;
	}

	public void setMin_ram(String min_ram) {
		this.min_ram = min_ram;
	}

	public String getMax_memory() {
		return max_memory;
	}

	public void setMax_memory(String max_memory) {
		this.max_memory = max_memory;
	}

	public String getMax_ram() {
		return max_ram;
	}

	public void setMax_ram(String max_ram) {
		this.max_ram = max_ram;
	}

}
