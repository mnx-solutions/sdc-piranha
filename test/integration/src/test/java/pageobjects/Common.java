package pageobjects;

import static com.codeborne.selenide.Condition.matchText;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static org.junit.Assert.assertTrue;

import org.openqa.selenium.NoSuchElementException;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

/**
 * Common interaction methods for UI elements
 * 
 */
public class Common {

	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));

	public static void login() {
		$(byAttribute("type", "button")).click();
		$(byAttribute("name", "username")).setValue(
				System.getProperty("loginusr"));
		$(byAttribute("name", "password")).setValue(
				System.getProperty("loginpw"));
		$("#login-submit").click();
		$(byAttribute("data-ng-show", "runningcount")).waitUntil(visible,
				BASE_TIMEOUT);
	}

	public static void checkSubHeadingText(String headingText) {
		ElementsCollection headingTextContainer = $$("legend");
		assertTrue(Common.checkTextInCollection(headingTextContainer,
				headingText).exists());
	}

	public static void openSubHeadingEditLink(String headingText) {
		ElementsCollection headingTextContainer = $$("legend");
		Common.checkTextInCollection(headingTextContainer, headingText)
				.$(byText("Edit")).click();
	}

	public static SelenideElement checkTextInCollection(ElementsCollection col,
			String filter) {
		for (SelenideElement element : col) {
			if (element.findAll(byText(filter)).size() > 0) {
				return element;
			}
		}
		throw new NoSuchElementException("Such element doesn't exist");
	}

	public static void checkHeadingText(String headingText) {
		$("h1").shouldHave(matchText("(.*)" + headingText + "(.*)"));
	}

	public static void clickNavigationLink(String text) {
		$(byText(text)).click();
	}

	public static int getCollectionIndexByText(ElementsCollection col,
			String filter) {
		int i = 0;
		$(byText(filter)).shouldBe(visible);
		for (SelenideElement element : col) {
			if (element.findAll(byText(filter)).size() > 0) {
				return i;
			}
			i++;
		}
		throw new NoSuchElementException("Such element doesn't exist");
	}

	public static void confirmModal() {
		$(".modal").shouldBe(visible);
		$(".modal-header").exists();
		$(".modal-footer").find(byText("OK")).click();
	}

	public static void cancelModal() {
		$(".modal").shouldBe(visible);
		$(".modal-header").exists();
		$(".modal-footer").find(byText("Cancel")).click();
	}

	public static void checkBreadcrumb(String active, String right) {
		$("ul.breadcrumb").should(matchText(active));
		$("ul.breadcrumb li.pull-right").shouldHave(text(right));
	}

	public static void errorNotPresent() {
		if ($(".alert-error").isDisplayed()) {
			System.out.println($(".alert-error").text());
		}
	}

}
