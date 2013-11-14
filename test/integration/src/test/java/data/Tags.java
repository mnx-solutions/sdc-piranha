package data;

public class Tags {
	public Tags(String role) {
		this.role = role;
	}

	private String role;

	@Override
	public String toString() {
		return "Tags [role=" + role + "]";
	}

	public String getRole() {
		return role;
	}

	public void setRole(String role) {
		this.role = role;
	}
}
